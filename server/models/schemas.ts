import mongoose, { Schema, Document } from 'mongoose';

export interface IAssignmentTemplate extends Document {
  assignmentKey: string;
  title: string;
  templateFileId?: string;
  maxPoints: number;
  teacherEmail?: string;
  createdAt: Date;
}

export interface IStudentSubmission extends Document {
  assignmentKey: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  fileId: string;
  title: string;
  mimeType: string;
  submitted: boolean;
  submittedAt?: Date;
}

const AssignmentTemplateSchema = new Schema<IAssignmentTemplate>({
  assignmentKey: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  templateFileId: { type: String },
  maxPoints: { type: Number, default: 100 },
  teacherEmail: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const StudentSubmissionSchema = new Schema<IStudentSubmission>({
  assignmentKey: { type: String, required: true, index: true },
  studentId: { type: String, required: true, index: true },
  studentName: { type: String, required: true },
  studentEmail: { type: String, required: true },
  fileId: { type: String, required: true },
  title: { type: String, required: true },
  mimeType: { type: String, required: true },
  submitted: { type: Boolean, default: false },
  submittedAt: { type: Date },
});

// Ensure each student has one unique submission record per assignment
StudentSubmissionSchema.index({ assignmentKey: 1, studentId: 1 }, { unique: true });

export const AssignmentTemplate = mongoose.model<IAssignmentTemplate>(
  'AssignmentTemplate',
  AssignmentTemplateSchema
);

export const StudentSubmission = mongoose.model<IStudentSubmission>(
  'StudentSubmission',
  StudentSubmissionSchema
);
