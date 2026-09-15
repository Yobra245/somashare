/**
 * SomaShare database seed — matches the Figma design content.
 * Run: bun scripts/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import { makePdf } from "./lib/minipdf";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import path from "path";

const db = new PrismaClient();
const STORAGE_DIR = path.join(process.cwd(), "storage");

function saveFile(name: string, buf: Buffer): string {
  mkdirSync(STORAGE_DIR, { recursive: true });
  writeFileSync(path.join(STORAGE_DIR, name), buf);
  return name;
}

function driveLikeId(): string {
  // 33-char base64url-ish id, mimicking Google Drive file ids
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let id = "1";
  for (let i = 0; i < 32; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

async function main() {
  console.log("Seeding SomaShare…");

  // wipe in dependency order
  await db.download.deleteMany();
  await db.resource.deleteMany();
  await db.unit.deleteMany();
  await db.user.deleteMany();

  // ---------- Units ----------
  const units = await Promise.all(
    [
      { code: "EET 300", title: "Electrical Machines I", department: "Engineering Department", shortLabel: "EET Elec" },
      { code: "EET 201", title: "Circuit Theory II", department: "Engineering Department", shortLabel: "EET Elec" },
      { code: "SIT 102", title: "Introduction to Database Systems", department: "Computing & IT Department", shortLabel: "SIT Tech" },
      { code: "SIT 204", title: "Data Structures & Algorithms", department: "Computing & IT Department", shortLabel: "SIT Tech" },
      { code: "BAC 201", title: "Business Communication", department: "Business Administration Department", shortLabel: "BAC Comm" },
      { code: "BAC 100", title: "Principles of Management", department: "Business Administration Department", shortLabel: "BAC Comm" },
      { code: "ACH 201", title: "Analytical Chemistry II", department: "Science Department", shortLabel: "ACH Sci" },
      { code: "BBT 105", title: "Introduction to Biotechnology", department: "Science Department", shortLabel: "BBT Sci" },
    ].map((u) => db.unit.create({ data: u }))
  );
  const unit = (code: string) => units.find((u) => u.code === code)!;

  // ---------- Users ----------
  const alex = await db.user.create({
    data: {
      email: "alex.ochieng@ku.ac.ke",
      name: "Alex Ochieng",
      department: "Engineering",
      yearOfStudy: "Year 3",
      driveConnected: true,
      driveEmail: "alex.ochieng@ku.ac.ke",
    },
  });
  await db.user.create({
    data: {
      email: "maria.wambui@ku.ac.ke",
      name: "Maria Wambui",
      department: "Computing & IT",
      yearOfStudy: "Year 2",
      driveConnected: true,
      driveEmail: "maria.wambui@ku.ac.ke",
    },
  });
  await db.user.create({
    data: {
      email: "paul.ngugi@ku.ac.ke",
      name: "Paul Ngugi",
      department: "Engineering",
      yearOfStudy: "Year 4",
      driveConnected: true,
      driveEmail: "paul.ngugi@ku.ac.ke",
    },
  });
  await db.user.create({
    data: {
      email: "jkamau@ku.ac.ke",
      name: "Dr. Kamau (Provided by Student)",
      department: "Engineering",
      yearOfStudy: "Year 3",
      driveConnected: false,
    },
  });

  // ---------- Resources (file bytes written to ./storage = sandbox Drive) ----------
  const mk = async (r: {
    title: string;
    unitCode: string;
    type: string;
    academicYear: string;
    examYear: number;
    semester: number;
    uploaderName: string;
    uploaderId?: string;
    verified: boolean;
    downloads: number;
    daysAgo: number;
    lines: string[];
  }) => {
    const slug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
    const fname = `${slug}-${Math.random().toString(36).slice(2, 6)}.pdf`;
    const buf = makePdf(r.title, r.lines);
    saveFile(fname, buf);
    return db.resource.create({
      data: {
        title: r.title,
        unitId: unit(r.unitCode).id,
        type: r.type,
        academicYear: r.academicYear,
        examYear: r.examYear,
        semester: r.semester,
        uploaderName: r.uploaderName,
        uploaderId: r.uploaderId,
        fileName: fname,
        fileSize: buf.length,
        mimeType: "application/pdf",
        driveFileId: driveLikeId(),
        webViewLink: `https://drive.google.com/file/d/${driveLikeId()}/view`,
        verified: r.verified,
        downloadCount: r.downloads,
        createdAt: new Date(Date.now() - r.daysAgo * 86400000),
      },
    });
  };

  await mk({
    title: "Electrical Machines I - Transformer Core Designs Complete",
    unitCode: "EET 300",
    type: "LECTURE_NOTES",
    academicYear: "Year 3",
    examYear: 2024,
    semester: 1,
    uploaderName: "Alex Ochieng",
    uploaderId: alex.id,
    verified: true,
    downloads: 245,
    daysAgo: 2,
    lines: [
      "SomaShare Vault · Lecture Notes · EET 300",
      "Unit: Electrical Machines I — Kenyatta University",
      "",
      "Topics covered:",
      "1. Magnetic circuits and core materials",
      "2. Transformer construction: core vs shell types",
      "3. Eddy current losses and lamination design",
      "4. Hysteresis loops and Steinmetz equation",
      "5. Winding arrangements and insulation",
      "6. Worked examples from past KU exams",
      "",
      "Contributed by a fellow KU peer via shared Drive storage.",
    ],
  });

  await mk({
    title: "SIT 102: Introduction to Database Systems - 2024 End Sem",
    unitCode: "SIT 102",
    type: "PAST_PAPER",
    academicYear: "Year 1",
    examYear: 2024,
    semester: 2,
    uploaderName: "Maria Wambui",
    verified: true,
    downloads: 512,
    daysAgo: 5,
    lines: [
      "KENYATTA UNIVERSITY",
      "END OF SEMESTER EXAMINATION — 2024",
      "UNIT: SIT 102 — Introduction to Database Systems",
      "TIME: 2 HOURS   ANSWER QUESTION ONE AND ANY OTHER TWO",
      "",
      "Q1. (30 marks) Define the following terms as used in databases:",
      "(a) Data independence (b) Candidate key (c) Normalisation",
      "Q2. (20 marks) Draw an ERD for a university library system.",
      "Q3. (20 marks) Write SQL to create and query STUDENT tables.",
      "Q4. (20 marks) Explain ACID properties with examples.",
      "",
      "Shared for revision purposes only.",
    ],
  });

  await mk({
    title: "EET 300 End Sem Exam - December 2024 Paper",
    unitCode: "EET 300",
    type: "PAST_PAPER",
    academicYear: "Year 3",
    examYear: 2024,
    semester: 1,
    uploaderName: "Alex Ochieng",
    uploaderId: alex.id,
    verified: true,
    downloads: 189,
    daysAgo: 8,
    lines: [
      "KENYATTA UNIVERSITY",
      "END OF SEMESTER EXAMINATION — DECEMBER 2024",
      "UNIT: EET 300 — Electrical Machines I",
      "TIME: 2 HOURS",
      "",
      "Q1. Derive the EMF equation of a transformer. (10 marks)",
      "Q2. A 200kVA transformer has full-load copper loss of 2.1kW...",
      "Q3. Explain speed control methods of DC shunt motors.",
      "Q4. Three-phase induction motor slip calculations.",
      "",
      "Shared for revision purposes only.",
    ],
  });

  await mk({
    title: "EET 300 Cat 1 & Cat 2 Continuous Assessments with Solutions",
    unitCode: "EET 300",
    type: "PAST_PAPER",
    academicYear: "Year 3",
    examYear: 2024,
    semester: 1,
    uploaderName: "Paul Ngugi",
    verified: true,
    downloads: 98,
    daysAgo: 12,
    lines: [
      "EET 300 — Continuous Assessment Tests (CAT 1 & CAT 2)",
      "Includes worked solutions and marking guide.",
      "",
      "CAT 1: Magnetic circuits, mutual inductance",
      "CAT 2: Transformer efficiency and regulation",
      "",
      "Shared for revision purposes only.",
    ],
  });

  await mk({
    title: "EET 300 Supplementary Examination Paper - Sept 2023",
    unitCode: "EET 300",
    type: "PAST_PAPER",
    academicYear: "Year 3",
    examYear: 2023,
    semester: 2,
    uploaderName: "Dr. Kamau (Provided by Student)",
    verified: true,
    downloads: 56,
    daysAgo: 30,
    lines: [
      "KENYATTA UNIVERSITY",
      "SUPPLEMENTARY EXAMINATION — SEPTEMBER 2023",
      "UNIT: EET 300 — Electrical Machines I",
      "",
      "Answer FIVE questions. All questions carry equal marks.",
      "",
      "Shared for revision purposes only.",
    ],
  });

  await mk({
    title: "Electrical Machines II - Synchronous Machine Notes",
    unitCode: "EET 300",
    type: "LECTURE_NOTES",
    academicYear: "Year 3",
    examYear: 2025,
    semester: 2,
    uploaderName: "Faith Njeri",
    verified: true,
    downloads: 134,
    daysAgo: 1,
    lines: [
      "SomaShare Vault · Lecture Notes · EET 300",
      "Synchronous machines: construction, operation, V-curves.",
      "Includes tutorial set and summary formula sheet.",
    ],
  });

  await mk({
    title: "Circuit Theory II - Theorems Revision Slides",
    unitCode: "EET 201",
    type: "REVISION_SLIDES",
    academicYear: "Year 2",
    examYear: 2024,
    semester: 2,
    uploaderName: "Paul Ngugi",
    verified: true,
    downloads: 221,
    daysAgo: 3,
    lines: [
      "SomaShare Vault · Revision Slides · EET 201",
      "Thevenin, Norton, superposition, max power transfer.",
      "Quick-fire practice problems with answers.",
    ],
  });

  await mk({
    title: "SIT 204: Data Structures & Algorithms - 2023 End Sem",
    unitCode: "SIT 204",
    type: "PAST_PAPER",
    academicYear: "Year 2",
    examYear: 2023,
    semester: 2,
    uploaderName: "Maria Wambui",
    verified: true,
    downloads: 305,
    daysAgo: 15,
    lines: [
      "KENYATTA UNIVERSITY — SIT 204 END SEM 2023",
      "Trees, graphs, sorting complexity, hashing.",
      "Shared for revision purposes only.",
    ],
  });

  await mk({
    title: "Database Systems - SQL Practice Question Bank",
    unitCode: "SIT 102",
    type: "REVISION_SLIDES",
    academicYear: "Year 1",
    examYear: 2025,
    semester: 1,
    uploaderName: "Maria Wambui",
    verified: true,
    downloads: 178,
    daysAgo: 4,
    lines: [
      "SomaShare Vault · Revision Slides · SIT 102",
      "80 practice SQL questions ordered by difficulty.",
      "Covers DDL, DML, joins, subqueries, views.",
    ],
  });

  await mk({
    title: "BAC 201 Business Communication - 2024 End Sem Paper",
    unitCode: "BAC 201",
    type: "PAST_PAPER",
    academicYear: "Year 2",
    examYear: 2024,
    semester: 2,
    uploaderName: "Brian Kimani",
    verified: true,
    downloads: 143,
    daysAgo: 6,
    lines: [
      "KENYATTA UNIVERSITY — BAC 201 END SEM 2024",
      "Report writing, memos, meetings, interviews.",
      "Shared for revision purposes only.",
    ],
  });

  await mk({
    title: "Principles of Management - Full Course Summary Notes",
    unitCode: "BAC 100",
    type: "LECTURE_NOTES",
    academicYear: "Year 1",
    examYear: 2025,
    semester: 1,
    uploaderName: "Brian Kimani",
    verified: false,
    downloads: 67,
    daysAgo: 9,
    lines: [
      "SomaShare Vault · Lecture Notes · BAC 100",
      "Planning, organising, staffing, leading, controlling.",
      "Condensed 12-page summary for quick revision.",
    ],
  });

  await mk({
    title: "Analytical Chemistry II - Titration Lab Reports Pack",
    unitCode: "ACH 201",
    type: "ASSIGNMENT",
    academicYear: "Year 2",
    examYear: 2024,
    semester: 1,
    uploaderName: "Njeri Mwangi",
    verified: false,
    downloads: 44,
    daysAgo: 11,
    lines: [
      "SomaShare Vault · Assignment Guide · ACH 201",
      "Sample lab report format, error analysis, calculations.",
    ],
  });

  const counts = {
    users: await db.user.count(),
    units: await db.unit.count(),
    resources: await db.resource.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
