import { resumeStorage } from '../../common/services/resume-storage';
import { parseResumeBuffer } from './resume-parser';
import { Request } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import crypto from 'crypto';
import { randomUUID as uuidv4 } from 'crypto';
import config from '../../config';
import logger from '../../config/logger';
import Resume from './resume.model';
import { ResumeVersion } from './resume.model';
import ResumeProfile, { IResumeProfile, IExtractedSkill, IExperience, IProject, IEducation, ICertification } from './resume-profile.model';
import InterviewProfile from '../profile/interview-profile.model';
import { BadRequestError, NotFoundError, InternalError } from '../../common/filters/error-filter';
import { Question } from '../questions/question.model';

// Resume service
export const resumeService = {
  // Validate file
  validateFile(file: Express.Multer.File): void {
    // Check file type
    const allowedTypes = config.upload.allowedTypes;
    const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);

    if (!allowedTypes.includes(fileExtension)) {
      throw new BadRequestError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Check MIME type
    const allowedMimeTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (file.mimetype && !allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestError('Invalid file MIME type');
    }

    // Check file size
    const maxSizeBytes = config.upload.maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestError(`File size exceeds limit of ${config.upload.maxSizeMB}MB`);
    }

    // Check file content integrity
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestError('Empty file');
    }
  },

  // Calculate file checksum
  calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  },

  // Save uploaded file
  async saveFile(file: Express.Multer.File, userId: string): Promise<{
    storagePath: string;
    storageKey: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
  }> {
    // Generate unique storage key
    const storageKey = `${userId}/${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    const storagePath = storageKey;

    // Save file
    await resumeStorage.put(storageKey, file.buffer, file.mimetype);

    logger.info('File saved', {
      userId,
      storageKey,
      originalFilename: file.originalname,
      fileSize: file.size,
    });

    return {
      storagePath,
      storageKey,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
    };
  },

  // Delete file
  async deleteFile(storageKey: string, provider = config.upload.provider): Promise<void> {
    await resumeStorage.delete(storageKey, provider);
  },

  // Upload resume
  async uploadResume(
    userId: string,
    file: Express.Multer.File
  ): Promise<{ resumeVersion: any; resume: any }> {
    // Validate file
    this.validateFile(file);

    // Calculate checksum
    const checksum = this.calculateChecksum(file.buffer);

    // Atomically allocate a version number; concurrent uploads cannot overwrite each other.
    const resume = await Resume.findOneAndUpdate({ userId }, {
      $inc:{totalVersions:1}, $set:{isDeleted:false}, $setOnInsert:{uploadDate:new Date()},
    },{upsert:true,new:true,setDefaultsOnInsert:true});
    const versionNumber = resume.totalVersions;

    // Save file
    const { storagePath, storageKey, originalFilename, mimeType, fileSize } = await this.saveFile(file, userId);

    // Create resume version
    let resumeVersion;
    try {
    resumeVersion = await ResumeVersion.create({
      userId,
      storageProvider: config.upload.provider,
      versionNumber,
      originalFilename,
      mimeType,
      fileSize,
      storagePath,
      storageKey,
      checksum,
      parsed: false,
      parseStatus: 'pending',
    });

    } catch(error) {
      await resumeStorage.delete(storageKey);
      throw error;
    }

    await Resume.updateOne({_id:resume._id},{$push:{versions:resumeVersion._id}});
    await Resume.updateOne({_id:resume._id,totalVersions:versionNumber},{$set:{currentVersionId:resumeVersion._id}});
    await InterviewProfile.updateOne({userId},{$set:{onboardingCompleted:false}});

    logger.info('Resume uploaded', {
      userId,
      versionNumber,
      resumeVersionId: resumeVersion._id,
      originalFilename,
    });

    // Create initial resume profile (will be parsed asynchronously)
    await ResumeProfile.create({
      userId: new mongoose.Types.ObjectId(userId),
      resumeVersionId: resumeVersion._id,
      versionNumber,
      skills: [],
      experience: [],
      projects: [],
      education: [],
      certifications: [],
      parserVersion: '1.0.0',
      confidence: 0,
      extractedAt: new Date(),
      userModified: false,
    });

    return {
      resumeVersion,
      resume,
    };
  },

  // Parse resume (would use AI in production)
  async parseResume(resumeVersionId: string): Promise<IResumeProfile> {
    const resumeVersion = await ResumeVersion.findById(resumeVersionId);

    if (!resumeVersion) {
      throw new NotFoundError('Resume version not found');
    }

    // Mark as processing
    resumeVersion.parseStatus = 'processing';
    await resumeVersion.save();

    try {
      // In production, this would use AI to parse the resume
      // For now, we'll use a simplified parsing approach

      const resumeProfile = await ResumeProfile.findOne({
        resumeVersionId: resumeVersion._id,
      });

      if (!resumeProfile) {
        throw new NotFoundError('Resume profile not found');
      }

      // Parse resume content (simulated - in production use AI)
      const parsedData = await parseResumeBuffer(await resumeStorage.get(resumeVersion.storageKey, resumeVersion.storageProvider || 'local'), resumeVersion.mimeType, String(resumeProfile.userId));

      // Update resume profile with parsed data
      resumeProfile.fullName = parsedData.fullName;
      resumeProfile.currentRole = parsedData.currentRole;
      resumeProfile.totalExperienceMonths = parsedData.totalExperienceMonths;
      resumeProfile.email = parsedData.email;
      resumeProfile.phone = parsedData.phone;
      resumeProfile.location = parsedData.location;
      resumeProfile.linkedinUrl = parsedData.linkedinUrl;
      resumeProfile.githubUrl = parsedData.githubUrl;

      // Skills
      resumeProfile.skills = parsedData.skills.map((skill: any, index: number) => ({
        _id: new mongoose.Types.ObjectId(),
        name: skill.name,
        category: skill.category,
        proficiency: skill.proficiency,
        confidence: skill.confidence || 0.5,
        source: 'parser',
        isConfirmed: false,
        isRemoved: false,
      }));

      // Experience
      resumeProfile.experience = parsedData.experience.map((exp, index) => ({
        _id: new mongoose.Types.ObjectId(),
        ...exp,
        startDate: exp.startDate ? new Date(exp.startDate) : undefined,
        isConfirmed: false, isRemoved: false,
        endDate: exp.endDate ? new Date(exp.endDate) : null,
      }));

      // Projects
      resumeProfile.projects = parsedData.projects.map((proj, index) => ({
        _id: new mongoose.Types.ObjectId(),
        ...proj,
        isConfirmed: false, isRemoved: false,
        startDate: proj.startDate ? new Date(proj.startDate) : undefined,
        endDate: proj.endDate ? new Date(proj.endDate) : undefined,
      }));

      // Education
      resumeProfile.education = parsedData.education.map((edu, index) => ({
        _id: new mongoose.Types.ObjectId(),
        ...edu,
        startDate: edu.startDate ? new Date(edu.startDate) : undefined,
        endDate: edu.endDate ? new Date(edu.endDate) : undefined,
      }));

      // Certifications
      resumeProfile.certifications = parsedData.certifications.map((cert, index) => ({
        _id: new mongoose.Types.ObjectId(),
        ...cert,
        date: cert.date ? new Date(cert.date) : undefined,
        expiration: cert.expiration ? new Date(cert.expiration) : undefined,
      }));

      resumeProfile.parserVersion = 'text-extraction-v2';
      resumeProfile.confidence = 0.5;
      resumeProfile.extractedAt = new Date();
      resumeProfile.parsingNotes = [config.ai.apiKey ? 'AI extraction: review all claims' : 'Local skill extraction: add experience and projects manually'];

      resumeProfile.userModified = false;
      await resumeProfile.save();
      await InterviewProfile.updateOne({userId:resumeProfile.userId},{$set:{onboardingCompleted:false}});

      // Mark as parsed
      resumeVersion.parsed = true;
      resumeVersion.parseStatus = 'completed';
      resumeVersion.parsedAt = new Date();
      await resumeVersion.save();

      logger.info('Resume parsed', {
        resumeVersionId,
        skillsCount: resumeProfile.skills.length,
        experienceCount: resumeProfile.experience.length,
        projectsCount: resumeProfile.projects.length,
      });

      return resumeProfile;
    } catch (err) {
      resumeVersion.parseStatus = 'failed';
      await resumeVersion.save();

      logger.error('Resume parsing failed', {
        resumeVersionId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });

      if (err instanceof BadRequestError) throw err;
      throw new InternalError('Failed to parse resume. Check file readability and AI configuration.');
    }
  },

  // Get user's resume
  async getResume(userId: string): Promise<any> {
    const resume = await Resume.findOne({ userId, isDeleted: false })
      .populate({
        path: 'currentVersionId',
        model: 'ResumeVersion',
      })
      .lean();

    if (!resume) {
      return null;
    }

    // Get latest resume profile
    const profile = await ResumeProfile.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      resumeVersionId: resume.currentVersionId?._id,
    }).lean();

    return {
      resume: {
        id: resume._id,
        currentVersionId: resume.currentVersionId?._id,
        versions: resume.versions,
        uploadDate: resume.uploadDate,
        totalVersions: resume.totalVersions,
      },
      currentVersion: resume.currentVersionId,
      profile,
    };
  },

  // Replace resume
  async replaceResume(userId: string, file: Express.Multer.File): Promise<any> {
    // Validate file
    this.validateFile(file);

    // Retain previous versions until explicit deletion.
    // Upload new resume (reuses uploadResume logic)
    return this.uploadResume(userId, file);
  },

  // Delete resume
  async deleteResume(userId: string): Promise<void> {
    const resume = await Resume.findOne({ userId, isDeleted: false });

    if (!resume) {
      throw new NotFoundError('Resume not found');
    }

    // Delete files
    for (const versionId of resume.versions) {
      const version = await ResumeVersion.findById(versionId);
      if (version) {
        await this.deleteFile(version.storageKey, version.storageProvider || 'local');
      }
    }

    // Mark resume as deleted
    resume.isDeleted = true;
    resume.deletedAt = new Date();
    await resume.save();

    // Also delete associated resume profiles
    await ResumeProfile.deleteMany({ userId: new mongoose.Types.ObjectId(userId) });

    logger.info('Resume deleted', { userId });
  },

  // Confirm/reject skills
  async updateResumeProfile(
    userId: string,
    resumeProfileId: string,
    updates: Partial<{
      skills: { name: string; isConfirmed: boolean; isRemoved: boolean }[];
      experience: any[];
      projects: any[];
      education: any[];
      certifications: any[];
    }>
  ): Promise<IResumeProfile> {
    const resumeProfile = await ResumeProfile.findOne({ userId, $or: [{ _id: resumeProfileId }, { resumeVersionId: resumeProfileId }] });

    if (!resumeProfile) {
      throw new NotFoundError('Resume profile not found');
    }

    if (String(resumeProfile.userId) !== userId) {
      throw new NotFoundError('Resume profile not found');
    }

    // Update skills
    if (updates.skills) {
      for (const skillUpdate of updates.skills) {
        const skill = resumeProfile.skills.find(
          s => s.name === skillUpdate.name
        );

        if (skill) {
          skill.isConfirmed = skillUpdate.isConfirmed;
          skill.isRemoved = skillUpdate.isRemoved;
          if (skill.isConfirmed) {
            skill.source = 'user';
          }
        }
      }
    }

    // Update other fields as needed
    if (updates.experience) {
      resumeProfile.experience = updates.experience;
    }

    if (updates.projects) {
      resumeProfile.projects = updates.projects;
    }

    if (updates.education) {
      resumeProfile.education = updates.education;
    }

    if (updates.certifications) {
      resumeProfile.certifications = updates.certifications;
    }

    resumeProfile.userModified = true;
    resumeProfile.modifiedAt = new Date();
    await resumeProfile.save();

    return resumeProfile;
  },

  // Regenerate interview profile from resume
  async regenerateInterviewProfile(userId: string): Promise<any> {
    const resume = await Resume.findOne({ userId, isDeleted: false });

    if (!resume) {
      throw new NotFoundError('No resume found. Please upload a resume first.');
    }

    const resumeProfile = await ResumeProfile.findOne({
      resumeVersionId: resume.currentVersionId,
    });

    if (!resumeProfile) {
      throw new NotFoundError('Resume profile not found');
    }

    // Create or update interview profile
    let interviewProfile = await InterviewProfile.findOne({ userId });

    if (!interviewProfile) {
      interviewProfile = await InterviewProfile.create({
        userId: new mongoose.Types.ObjectId(userId),
        resumeProfileId: resumeProfile._id,
        experienceLevel: 'other',
        targetRole: '',
        targetCompanies: [],
        onboardingCompleted: false,
        preferences: {
          dailyQuestions: 5,
          codingCount: 0,
          systemDesignCount: 0,
          projectQuestions: 0,
          studyDays: 90,
          focusTopics: [],
          excludedTopics: [],
          revisionFrequency: 'daily',
          mockInterviewDuration: 45,
          systemDesignFocus: [],
          codingFocus: [],
          codingLanguages: [],
          startTimeOfDay: 'morning',
          notificationEnabled: true,
        },
      });
    } else {
      interviewProfile.resumeProfileId = resumeProfile._id;
      await interviewProfile.save();
    }

    // Extract skills from confirmed resume profile
    const confirmedSkills = resumeProfile.skills
      .filter(s => s.isConfirmed && !s.isRemoved)
      .map(s => s.name);

    // Extract projects
    const confirmedProjects = resumeProfile.projects
      .filter((p: any) => p.isConfirmed && !p.isRemoved)
      .map((p: any) => p.name);

    // Extract experience
    const confirmedExperience = resumeProfile.experience
      .filter((e: any) => e.isConfirmed && !e.isRemoved)
      .map((e: any) => `${e.company} - ${e.role}`);

    // Update interview profile with resume data
    interviewProfile.confirmedSkills = confirmedSkills;
    interviewProfile.confirmedProjects = confirmedProjects;
    interviewProfile.confirmedExperience = confirmedExperience;

    // Extract primary languages from skills
    const languageCategories = ['programming_language'];
    interviewProfile.primaryLanguages = resumeProfile.skills
      .filter(s => languageCategories.includes(s.category) && s.isConfirmed)
      .map(s => s.name.toLowerCase());

    // Extract frameworks
    interviewProfile.frameworks = resumeProfile.skills
      .filter(s => s.category === 'framework' && s.isConfirmed)
      .map(s => s.name.toLowerCase());

    // Extract databases
    interviewProfile.databases = resumeProfile.skills
      .filter(s => ['database', 'sql', 'nosql'].includes(s.category) && s.isConfirmed)
      .map(s => s.name.toLowerCase());

    // Extract cloud
    interviewProfile.cloud = resumeProfile.skills
      .filter(s => ['cloud', 'aws', 'azure', 'gcp'].includes(s.category) && s.isConfirmed)
      .map(s => s.name.toLowerCase());

    // Extract AI technologies
    interviewProfile.aiTechnologies = resumeProfile.skills
      .filter(s => ['ai_ml', 'llm', 'rag'].includes(s.category) && s.isConfirmed)
      .map(s => s.name.toLowerCase());

    await interviewProfile.save();

    logger.info('Interview profile regenerated', {
      userId,
      skillsCount: confirmedSkills.length,
      projectsCount: confirmedProjects.length,
    });

    return {
      interviewProfile,
      resumeProfile,
    };
  },
};
