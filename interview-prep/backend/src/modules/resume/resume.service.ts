import { Request } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
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
    // Ensure upload directory exists
    await fs.mkdir(config.upload.storagePath, { recursive: true });

    // Generate unique storage key
    const storageKey = `${userId}/${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    const storagePath = path.join(config.upload.storagePath, storageKey);

    // Save file
    await fs.writeFile(storagePath, file.buffer);

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
  async deleteFile(storageKey: string): Promise<void> {
    const filePath = path.join(config.upload.storagePath, storageKey);

    try {
      await fs.unlink(filePath);
      logger.info('File deleted', { storageKey });
    } catch (err) {
      // File may not exist, ignore
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
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

    // Check if user already has a resume
    const existingResume = await Resume.findOne({ userId });

    let resume;
    let versionNumber: number;

    if (existingResume && !existingResume.isDeleted) {
      // Create new version
      versionNumber = existingResume.totalVersions + 1;
      resume = existingResume;
    } else {
      // Create new resume
      versionNumber = 1;
      resume = await Resume.create({
        userId,
        uploadDate: new Date(),
        totalVersions: 0,
        isDeleted: false,
      });
    }

    // Save file
    const { storagePath, storageKey, originalFilename, mimeType, fileSize } = await this.saveFile(file, userId);

    // Create resume version
    const resumeVersion = await ResumeVersion.create({
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

    // Add version to resume
    resume.versions.push(resumeVersion._id);
    resume.currentVersionId = resumeVersion._id;
    resume.totalVersions += 1;
    await resume.save();

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
      isModified: false,
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
      const parsedData = await this.parseResumeContent(resumeVersion.storagePath, resumeVersion.mimeType);

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
        proficiency: skill.proficiency || 'intermediate',
        confidence: skill.confidence || 0.5,
        source: 'parser',
        isConfirmed: false,
        isRemoved: false,
      }));

      // Experience
      resumeProfile.experience = parsedData.experience.map((exp, index) => ({
        _id: new mongoose.Types.ObjectId(),
        ...exp,
        startDate: new Date(exp.startDate),
        endDate: exp.endDate ? new Date(exp.endDate) : null,
      }));

      // Projects
      resumeProfile.projects = parsedData.projects.map((proj, index) => ({
        _id: new mongoose.Types.ObjectId(),
        ...proj,
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

      resumeProfile.parserVersion = '1.0.0';
      resumeProfile.confidence = 0.7; // Default confidence
      resumeProfile.extractedAt = new Date();
      resumeProfile.parsingNotes = ['Parsed successfully'];

      (resumeProfile as any).isModified = false;
      await resumeProfile.save();

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

      throw new InternalError('Failed to parse resume');
    }
  },

  // Simulated resume parsing (replace with actual AI in production)
  async parseResumeContent(
    filePath: string,
    mimeType: string
  ): Promise<{
    fullName: string;
    currentRole: string;
    totalExperienceMonths: number;
    email: string;
    phone: string;
    location: string;
    linkedinUrl: string;
    githubUrl: string;
    skills: Array<{ name: string; category: string; proficiency?: string; confidence?: number }>;
    experience: IExperience[];
    projects: IProject[];
    education: IEducation[];
    certifications: ICertification[];
  }> {
    // In production, this would:
    // 1. Extract text from PDF/DOCX
    // 2. Send to AI for structured extraction
    // 3. Return parsed data

    // For demonstration, return sample data
    // In real implementation, use pdf-parse or mammoth to extract text

    try {
      // For PDF
      if (mimeType === 'application/pdf') {
        // const pdf = require('pdf-parse');
        // const data = await pdf(filePath);
        // const text = data.text;
        // ... AI parsing
      }

      // For DOCX
      if (mimeType.includes('wordprocessingml')) {
        // const mammoth = require('mammoth');
        // const result = await mammoth.read(filePath);
        // const text = result.value;
        // ... AI parsing
      }

      // Return sample parsed data for demonstration
      return {
        fullName: 'Sample Candidate',
        currentRole: 'Software Engineer',
        totalExperienceMonths: 36,
        email: 'sample@example.com',
        phone: '+1-555-123-4567',
        location: 'San Francisco, CA',
        linkedinUrl: 'https://linkedin.com/in/sample',
        githubUrl: 'https://github.com/sample',
        skills: [
          { name: 'Java', category: 'programming_language', proficiency: 'advanced', confidence: 0.9 },
          { name: 'Spring Boot', category: 'framework', proficiency: 'intermediate', confidence: 0.8 },
          { name: 'JavaScript', category: 'programming_language', proficiency: 'intermediate', confidence: 0.8 },
          { name: 'Node.js', category: 'runtime', proficiency: 'intermediate', confidence: 0.7 },
          { name: 'React', category: 'framework', proficiency: 'intermediate', confidence: 0.7 },
          { name: 'MongoDB', category: 'database', proficiency: 'intermediate', confidence: 0.7 },
          { name: 'AWS', category: 'cloud', proficiency: 'intermediate', confidence: 0.7 },
          { name: 'Docker', category: 'devops', proficiency: 'basic', confidence: 0.6 },
          { name: 'Git', category: 'tools', proficiency: 'intermediate', confidence: 0.8 },
          { name: 'REST APIs', category: 'architecture', proficiency: 'intermediate', confidence: 0.8 },
        ],
        experience: [
          {
            company: 'Tech Company Inc.',
            role: 'Software Engineer',
            location: 'San Francisco, CA',
            startDate: '2021-01-15',
            endDate: '' as string,
            currentRole: true,
            totalMonths: 42,
            responsibilities: [
              'Developed microservices using Spring Boot and Java',
              'Designed REST APIs for internal services',
              'Implemented authentication and authorization with Spring Security',
              'Collaborated with cross-functional teams',
            ],
            technologies: ['Java', 'Spring Boot', 'MongoDB', 'AWS', 'Docker'],
            achievements: [
              'Reduced API response time by 40%',
              'Implemented caching strategy that improved throughput by 2x',
            ],
            projectReferences: ['Cortex AI Platform', 'Payment Processing Service'],
            technicalClaims: [
              'Designed scalable microservices architecture',
              'Implemented event-driven architecture using message queues',
            ],
          },
        ],
        projects: [
          {
            name: 'Cortex AI Platform',
            description: 'AI-powered RAG application for enterprise knowledge management',
            startDate: '2022-03-01',
            endDate: '' as string,
            isCurrent: true,
            technologies: ['Node.js', 'MongoDB', 'RAG', 'Pinecone', 'LangGraph'],
            responsibilities: [
              'Designed RAG pipeline architecture',
              'Implemented vector search with Pinecone',
              'Built real-time chat interface',
            ],
            architectureClaims: [
              'Microservices architecture with event-driven communication',
              'Stored embeddings in vector database for semantic search',
            ],
            features: [
              'AI-powered question answering',
              'Document ingestion pipeline',
              'Real-time chat interface',
              'Knowledge base management',
            ],
            performanceClaims: [
              'Retrieval latency under 100ms for typical queries',
              'Handles 10,000 concurrent users',
            ],
            metrics: [
              'latency: 100 ms — Average retrieval latency',
              'users: 10000 concurrent — Supported concurrent users',
            ],
            securityClaims: [
              'Implemented JWT authentication',
              'Encrypted sensitive data at rest',
            ],
            technicalDecisions: [
              'Chose Pinecone for vector storage due to ease of use',
              'Used LangGraph for stateful RAG workflows',
            ],
            teamSize: 5,
            role: 'Lead Engineer',
          },
          {
            name: 'Payment Processing Service',
            description: 'High-throughput payment processing microservice',
            startDate: '2021-06-01',
            endDate: '2022-03-01',
            isCurrent: false,
            technologies: ['Java', 'Spring Boot', 'MongoDB', 'Kafka'],
            responsibilities: [
              'Built payment processing API',
              'Implemented idempotent transaction handling',
              'Set up monitoring and alerting',
            ],
            architectureClaims: [
              'Event-driven architecture with Kafka for async processing',
              'Idempotent operations for reliability',
            ],
            features: [
              'Real-time payment processing',
              'Transaction logging',
              ' fraud detection alerts',
            ],
            performanceClaims: [
              'Processes 5000 transactions per second',
              '99.9% uptime SLA',
            ],
            metrics: [
              'throughput: 5000 tps — Transactions per second',
            ],
            securityClaims: [
              'PCI-DSS compliant design',
              'End-to-end encryption for payment data',
            ],
            technicalDecisions: [
              'Chose Kafka for high-throughput event streaming',
              'Implemented idempotency keys for duplicate prevention',
            ],
            teamSize: 3,
            role: 'Software Engineer',
          },
        ],
        education: [
          {
            institution: 'University of California, Berkeley',
            degree: 'Bachelor of Science',
            field: 'Computer Science',
            startDate: '2015-09-01',
            endDate: '2019-06-01',
            gpa: 3.7,
            honors: ['Magna Cum Laude', 'Phi Beta Kappa'],
          },
        ],
        certifications: [
          {
            name: 'AWS Certified Solutions Architect - Associate',
            issuer: 'Amazon Web Services',
            date: '2022-08-01',
            credentialId: 'AWS-SAA-123456',
          },
          {
            name: 'Oracle Certified Professional, Java SE 11 Developer',
            issuer: 'Oracle',
            date: '2021-05-01',
            credentialId: 'OCP-JAVA-789012',
          },
        ],
      };
    } catch (err) {
      throw new InternalError('Failed to parse resume content');
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

    // Delete old file if exists
    const existingResume = await Resume.findOne({ userId, isDeleted: false });

    if (existingResume?.currentVersionId) {
      const oldVersion = await ResumeVersion.findById(existingResume.currentVersionId);
      if (oldVersion) {
        await this.deleteFile(oldVersion.storageKey);
      }
    }

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
        await this.deleteFile(version.storageKey);
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
    const resumeProfile = await ResumeProfile.findById(resumeProfileId);

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

    (resumeProfile as any).isModified = true;
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
        experienceLevel: 'sde2',
        targetRole: 'sde2',
        targetCompanies: ['other'],
        onboardingCompleted: false,
        preferences: {
          dailyQuestions: 10,
          codingCount: 2,
          systemDesignCount: 2,
          projectQuestions: 5,
          studyDays: 90,
          focusTopics: [],
          excludedTopics: [],
          revisionFrequency: 'daily',
          mockInterviewDuration: 45,
          systemDesignFocus: ['hld', 'distributed', 'backend'],
          codingFocus: ['arrays', 'strings', 'trees', 'graphs', 'dynamic_programming'],
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
      .filter((p: any) => !(p as any).isRemoved)
      .map((p: any) => p.name);

    // Extract experience
    const confirmedExperience = resumeProfile.experience
      .filter((e: any) => !(e as any).isRemoved)
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
