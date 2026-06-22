import "dotenv/config";
import crypto from "node:crypto";
import { inArray } from "drizzle-orm";

import { db } from "./db/index.js";
import {
    classes,
    departments,
    enrollments,
    subjects,
    user,
    type Schedule,
} from "./db/schema/index.js";

/**
 * Idempotent seed: populates departments → subjects → users (teachers/students)
 * → classes → enrollments so the dashboard has rich, varied data.
 *
 * Run with:  npx tsx src/seed.ts
 *
 * Re-runnable: rows are keyed on their unique columns (department.code,
 * subject.code, user.email, class.inviteCode) with onConflictDoNothing, then
 * re-selected, so running twice will not create duplicates.
 */

const genId = () => crypto.randomBytes(16).toString("hex");

// A date `m` months before now (used to spread class creation across the
// dashboard's "created over time" chart).
const monthsAgo = (m: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - m);
    return d;
};

const sched = (day: string, startTime: string, endTime: string): Schedule => ({
    day,
    startTime,
    endTime,
});

async function seed() {
    console.log("Seeding…");

    // 1) Departments ---------------------------------------------------------
    const departmentSeed = [
        { code: "CS", name: "Computer Science", description: "Algorithms, systems, and software engineering." },
        { code: "MATH", name: "Mathematics", description: "Pure and applied mathematics." },
        { code: "PHYS", name: "Physics", description: "Classical and modern physics." },
        { code: "ENG", name: "English", description: "Literature, writing, and linguistics." },
        { code: "BIO", name: "Biology", description: "Life sciences and molecular biology." },
    ];
    await db.insert(departments).values(departmentSeed).onConflictDoNothing({
        target: departments.code,
    });
    const deptRows = await db
        .select()
        .from(departments)
        .where(inArray(departments.code, departmentSeed.map((d) => d.code)));
    const deptByCode = Object.fromEntries(deptRows.map((d) => [d.code, d.id]));
    console.log(`  departments: ${deptRows.length}`);

    // 2) Subjects ------------------------------------------------------------
    const subjectSeed = [
        { code: "CS101", name: "Intro to Programming", dept: "CS" },
        { code: "CS201", name: "Data Structures", dept: "CS" },
        { code: "CS301", name: "Operating Systems", dept: "CS" },
        { code: "MATH101", name: "Calculus I", dept: "MATH" },
        { code: "MATH201", name: "Linear Algebra", dept: "MATH" },
        { code: "PHYS101", name: "Mechanics", dept: "PHYS" },
        { code: "PHYS201", name: "Electromagnetism", dept: "PHYS" },
        { code: "ENG101", name: "Academic Writing", dept: "ENG" },
        { code: "ENG201", name: "Modern Literature", dept: "ENG" },
        { code: "BIO101", name: "Cell Biology", dept: "BIO" },
        { code: "BIO201", name: "Genetics", dept: "BIO" },
    ];
    await db
        .insert(subjects)
        .values(
            subjectSeed.map((s) => ({
                code: s.code,
                name: s.name,
                description: `${s.name} — core ${s.dept} subject.`,
                departmentId: deptByCode[s.dept]!,
            }))
        )
        .onConflictDoNothing({ target: subjects.code });
    const subjectRows = await db
        .select()
        .from(subjects)
        .where(inArray(subjects.code, subjectSeed.map((s) => s.code)));
    const subjectByCode = Object.fromEntries(subjectRows.map((s) => [s.code, s.id]));
    console.log(`  subjects: ${subjectRows.length}`);

    // 3) Users (1 admin, teachers, students) ---------------------------------
    const teacherSeed = [
        "Alan Turing",
        "Grace Hopper",
        "Katherine Johnson",
        "Richard Feynman",
        "Marie Curie",
        "Ada Lovelace",
    ];
    const studentSeed = Array.from({ length: 24 }, (_, i) => `Student ${i + 1}`);

    const emailFor = (name: string) =>
        `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@school.edu`;

    const userValues = [
        { name: "Admin User", email: "admin@school.edu", role: "admin" as const },
        ...teacherSeed.map((n) => ({ name: n, email: emailFor(n), role: "teacher" as const })),
        ...studentSeed.map((n) => ({ name: n, email: emailFor(n), role: "student" as const })),
    ].map((u) => ({ id: genId(), emailVerified: true, ...u }));

    await db.insert(user).values(userValues).onConflictDoNothing({
        target: user.email,
    });
    const userRows = await db
        .select()
        .from(user)
        .where(inArray(user.email, userValues.map((u) => u.email)));
    const teachers = userRows.filter((u) => u.role === "teacher");
    const students = userRows.filter((u) => u.role === "student");
    console.log(
        `  users: ${userRows.length} (teachers: ${teachers.length}, students: ${students.length})`
    );

    // 4) Classes -------------------------------------------------------------
    // Deterministic invite codes => idempotent. Spread createdAt over 6 months
    // and vary capacity/status so every dashboard chart has signal.
    const classSeed = [
        { invite: "SEED-CS101A", name: "Intro to Programming — Sec A", subj: "CS101", cap: 40, status: "active", ageMonths: 5 },
        { invite: "SEED-CS201A", name: "Data Structures — Sec A", subj: "CS201", cap: 35, status: "active", ageMonths: 4 },
        { invite: "SEED-CS301A", name: "Operating Systems — Sec A", subj: "CS301", cap: 30, status: "active", ageMonths: 3 },
        { invite: "SEED-MATH101A", name: "Calculus I — Sec A", subj: "MATH101", cap: 50, status: "active", ageMonths: 5 },
        { invite: "SEED-MATH201A", name: "Linear Algebra — Sec A", subj: "MATH201", cap: 25, status: "inactive", ageMonths: 2 },
        { invite: "SEED-PHYS101A", name: "Mechanics — Sec A", subj: "PHYS101", cap: 45, status: "active", ageMonths: 4 },
        { invite: "SEED-PHYS201A", name: "Electromagnetism — Sec A", subj: "PHYS201", cap: 20, status: "active", ageMonths: 1 },
        { invite: "SEED-ENG101A", name: "Academic Writing — Sec A", subj: "ENG101", cap: 30, status: "active", ageMonths: 3 },
        { invite: "SEED-ENG201A", name: "Modern Literature — Sec A", subj: "ENG201", cap: 28, status: "archived", ageMonths: 6 },
        { invite: "SEED-BIO101A", name: "Cell Biology — Sec A", subj: "BIO101", cap: 40, status: "active", ageMonths: 2 },
        { invite: "SEED-BIO201A", name: "Genetics — Sec A", subj: "BIO201", cap: 22, status: "active", ageMonths: 1 },
    ] as const;

    await db
        .insert(classes)
        .values(
            classSeed.map((c, i) => {
                const created = monthsAgo(c.ageMonths);
                return {
                    inviteCode: c.invite,
                    name: c.name,
                    subjectId: subjectByCode[c.subj]!,
                    teacherId: teachers[i % teachers.length]!.id,
                    capacity: c.cap,
                    description: `${c.name}. Auto-seeded class for demo purposes.`,
                    status: c.status,
                    bannerUrl: `https://picsum.photos/seed/${encodeURIComponent(c.invite)}/600/400`,
                    schedules: [
                        sched(i % 2 === 0 ? "Monday" : "Tuesday", "09:00", "10:30"),
                        sched(i % 2 === 0 ? "Wednesday" : "Thursday", "09:00", "10:30"),
                    ],
                    createdAt: created,
                    updatedAt: created,
                };
            })
        )
        .onConflictDoNothing({ target: classes.inviteCode });
    const classRows = await db
        .select()
        .from(classes)
        .where(inArray(classes.inviteCode, classSeed.map((c) => c.invite)));
    console.log(`  classes: ${classRows.length}`);

    // 5) Enrollments ---------------------------------------------------------
    // Fill each class to a varied fraction of capacity (some near full → red
    // capacity badges, some light) without exceeding capacity.
    const enrollmentValues: { studentId: string; classId: number; createdAt: Date }[] = [];
    classRows.forEach((cls, idx) => {
        // target between 50% and 100% of capacity, capped by available students
        const fraction = 0.5 + ((idx * 0.13) % 0.5);
        const target = Math.min(
            students.length,
            Math.max(1, Math.round(cls.capacity * fraction))
        );
        // rotate the student window so different classes get different students
        for (let k = 0; k < target; k++) {
            const student = students[(idx * 7 + k) % students.length]!;
            enrollmentValues.push({
                studentId: student.id,
                classId: cls.id,
                createdAt: monthsAgo(Math.max(0, (idx % 6) - (k % 3))),
            });
        }
    });
    // Deduplicate (studentId+classId is unique) before insert
    const seen = new Set<string>();
    const uniqueEnrollments = enrollmentValues.filter((e) => {
        const key = `${e.studentId}:${e.classId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    await db.insert(enrollments).values(uniqueEnrollments).onConflictDoNothing();
    console.log(`  enrollments inserted (attempted): ${uniqueEnrollments.length}`);

    console.log("Seed complete ✅");
}

seed()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Seed failed:", err);
        process.exit(1);
    });
