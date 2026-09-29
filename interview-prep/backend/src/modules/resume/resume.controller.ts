import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import config from '../../config';
import { BadRequestError, asyncHandler } from '../../common/filters/error-filter';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { uploadRateLimiter } from '../../common/middleware/rate-limit';
import { resumeService } from './resume.service';
import { Resume, ResumeVersion } from './resume.model';
import ResumeProfile from './resume-profile.model';
import { NotFoundError } from '../../common/filters/error-filter';
import { z } from 'zod';

import { resumeStorage } from '../../common/services/resume-storage';
const router = Router();
router.get('/files/:id', authenticate, asyncHandler(async(req:AuthenticatedRequest,res)=>{
  const resume=await Resume.findOne({userId:req.user!.id,isDeleted:false,versions:req.params.id});
  if(!resume) throw new NotFoundError('Resume version not found');
  const version=await ResumeVersion.findById(req.params.id);
  if(!version) throw new NotFoundError('Resume version not found');
  const bytes=await resumeStorage.get(version.storageKey,version.storageProvider || 'local');
  res.setHeader('Cache-Control','no-store');
  res.type(version.mimeType).attachment(path.basename(version.originalFilename)).send(bytes);
}));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxSizeMB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = config.upload.allowedTypes;
    const extension = path.extname(file.originalname).toLowerCase().slice(1);

    if (allowedTypes.includes(extension)) {
      cb(null, true);
    } else {
      cb(new BadRequestError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`) as any, false);
    }
  },
});

// Upload resume
router.post(
  '/upload',
  authenticate,
  uploadRateLimiter,
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      throw new BadRequestError('No file provided');
    }

    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const result = await resumeService.uploadResume(req.user.id, req.file);

    res.status(201).json({
      success: true,
      data: {
        resumeVersion: {
          id: result.resumeVersion._id,
          versionNumber: result.resumeVersion.versionNumber,
          originalFilename: result.resumeVersion.originalFilename,
          fileSize: result.resumeVersion.fileSize,
          mimeType: result.resumeVersion.mimeType,
        },
        resume: {
          id: result.resume._id,
          totalVersions: result.resume.totalVersions,
        },
        message: 'Resume uploaded successfully. Parsing will begin shortly.',
      },
    });
  })
);

// Parse resume
router.post(
  '/parse/:resumeVersionId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const { resumeVersionId } = req.params;

    const resumeVersion = await ResumeVersion.findById(resumeVersionId);

    if (!resumeVersion) {
      throw new NotFoundError('Resume version not found');
    }

    // Check ownership
    const resume = await Resume.findOne({
      userId: req.user.id,
      'versions': resumeVersionId,
    });

    if (!resume) {
      throw new NotFoundError('Resume not found');
    }

    const profile = await resumeService.parseResume(resumeVersionId);

    res.json({
      success: true,
      data: {
        profileId: profile._id,
        versionNumber: profile.versionNumber,
        parsedAt: profile.extractedAt,
        skillsCount: profile.skills.filter(s => !s.isRemoved).length,
        experienceCount: profile.experience.length,
        projectsCount: profile.projects.length,
        educationCount: profile.education.length,
        certificationsCount: profile.certifications.length,
      },
      message: 'Resume parsed successfully',
    });
  })
);

// Get resume
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const result = await resumeService.getResume(req.user.id);

    if (!result) {
      return res.json({
        success: true,
        data: null,
        message: 'No resume uploaded yet',
      });
    }

    res.json({
      success: true,
      data: result,
    });
  })
);

// Replace resume
router.put(
  '/replace',
  authenticate,
  uploadRateLimiter,
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      throw new BadRequestError('No file provided');
    }

    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const result = await resumeService.replaceResume(req.user.id, req.file);

    res.json({
      success: true,
      data: {
        resumeVersion: {
          id: result.resumeVersion._id,
          versionNumber: result.resumeVersion.versionNumber,
          originalFilename: result.resumeVersion.originalFilename,
          fileSize: result.resumeVersion.fileSize,
          mimeType: result.resumeVersion.mimeType,
        },
        resume: {
          id: result.resume._id,
          totalVersions: result.resume.totalVersions,
        },
        message: 'Resume replaced successfully. Previous resume has been archived.',
      },
    });
  })
);

// Delete resume
router.delete(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    await resumeService.deleteResume(req.user.id);

    res.json({
      success: true,
      message: 'Resume deleted successfully',
    });
  })
);

// Get resume profile
router.get(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const resume = await Resume.findOne({ userId: req.user.id, isDeleted: false }).lean();

    if (!resume || !resume.currentVersionId) {
      throw new NotFoundError('No resume profile found');
    }

    const profile = await ResumeProfile.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
      resumeVersionId: resume.currentVersionId,
    }).lean();

    if (!profile) {
      throw new NotFoundError('Resume profile not found');
    }

    res.json({
      success: true,
      data: {
        id: profile._id,
        versionNumber: profile.versionNumber,
        fullName: profile.fullName,
        currentRole: profile.currentRole,
        totalExperienceMonths: profile.totalExperienceMonths,
        email: profile.email,
        phone: profile.phone,
        location: profile.location,
        linkedinUrl: profile.linkedinUrl,
        githubUrl: profile.githubUrl,
        skills: profile.skills.filter(s => !s.isRemoved),
        experience: profile.experience,
        projects: profile.projects,
        education: profile.education,
        certifications: profile.certifications,
        confidence: profile.confidence,
        isModified: profile.userModified,
      },
    });
  })
);

// Update resume profile (confirm skills, edit info)
router.put(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const resume = await Resume.findOne({ userId: req.user.id, isDeleted: false }).lean();

    if (!resume || !resume.currentVersionId) {
      throw new NotFoundError('No resume profile found');
    }

    // Validate update data
    const updateSchema = z.object({
      fullName: z.string().optional(),
      currentRole: z.string().optional(),
      totalExperienceMonths: z.number().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      location: z.string().optional(),
      linkedinUrl: z.string().url().optional().nullable(),
      githubUrl: z.string().url().optional().nullable(),
      skills: z.array(z.object({
        name: z.string(),
        isConfirmed: z.boolean(),
        isRemoved: z.boolean(),
      })).optional(),
      experience: z.array(z.any()).optional(),
      projects: z.array(z.any()).optional(),
      education: z.array(z.any()).optional(),
      certifications: z.array(z.any()).optional(),
    });

    const validatedData = updateSchema.parse(req.body);

    const profile = await resumeService.updateResumeProfile(
      req.user.id,
      resume.currentVersionId.toString(),
      validatedData
    );

    res.json({
      success: true,
      data: {
        id: profile._id,
        message: 'Resume profile updated successfully',
      },
    });
  })
);

// Regenerate interview profile from resume
router.post(
  '/regenerate-profile',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const result = await resumeService.regenerateInterviewProfile(req.user.id);

    res.json({
      success: true,
      data: {
        interviewProfileId: result.interviewProfile._id,
        resumeProfileId: result.resumeProfile._id,
        message: 'Interview profile regenerated from resume',
      },
    });
  })
);

// Get resume versions
router.get(
  '/versions',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    const resume = await Resume.findOne({ userId: req.user.id, isDeleted: false })
      .populate({
        path: 'versions',
        model: 'ResumeVersion',
        options: { sort: { versionNumber: -1 } },
      })
      .lean();

    if (!resume) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const versions = resume.versions.map((v: any) => ({
      id: v._id,
      versionNumber: v.versionNumber,
      originalFilename: v.originalFilename,
      fileSize: v.fileSize,
      mimeType: v.mimeType,
      parsed: v.parsed,
      parseStatus: v.parseStatus,
      parsedAt: v.parsedAt,
      createdAt: v.createdAt,
      isCurrent: v._id.toString() === resume.currentVersionId?.toString(),
    }));

    res.json({
      success: true,
      data: versions,
    });
  })
);

export default router;

// Import mongoose for typing
import mongoose from 'mongoose';
