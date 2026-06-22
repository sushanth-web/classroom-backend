import express from "express";
import { and, eq, getTableColumns, sql } from "drizzle-orm";

import { db } from "../db/index.js";
import {
    classes,
    departments,
    enrollments,
    subjects,
    user,
} from "../db/schema/index.js";

const router = express.Router();

const getEnrollmentDetails = async (enrollmentId: number) => {
    const [enrollment] = await db
        .select({
            ...getTableColumns(enrollments),
            class: {
                ...getTableColumns(classes),
            },
            subject: {
                ...getTableColumns(subjects),
            },
            department: {
                ...getTableColumns(departments),
            },
            teacher: {
                ...getTableColumns(user),
            },
        })
        .from(enrollments)
        .leftJoin(classes, eq(enrollments.classId, classes.id))
        .leftJoin(subjects, eq(classes.subjectId, subjects.id))
        .leftJoin(departments, eq(subjects.departmentId, departments.id))
        .leftJoin(user, eq(classes.teacherId, user.id))
        .where(eq(enrollments.id, enrollmentId));

    return enrollment;
};

// Returns 409-friendly result: enrolls a student into a class after validating
// existence, duplicate enrollment, and remaining capacity.
const enrollStudent = async (
    classId: number,
    studentId: string
): Promise<{ status: number; body: Record<string, unknown> }> => {
    const [classRecord] = await db
        .select()
        .from(classes)
        .where(eq(classes.id, classId));

    if (!classRecord) return { status: 404, body: { error: "Class not found" } };

    const [student] = await db.select().from(user).where(eq(user.id, studentId));

    if (!student) return { status: 404, body: { error: "Student not found" } };

    const [existingEnrollment] = await db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
            and(eq(enrollments.classId, classId), eq(enrollments.studentId, studentId))
        );

    if (existingEnrollment)
        return { status: 409, body: { error: "Student already enrolled in class" } };

    const [{ count: enrolledCount } = { count: 0 }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(enrollments)
        .where(eq(enrollments.classId, classId));

    if (Number(enrolledCount) >= classRecord.capacity) {
        return {
            status: 409,
            body: { error: "Class is at full capacity" },
        };
    }

    const [createdEnrollment] = await db
        .insert(enrollments)
        .values({ classId, studentId })
        .returning({ id: enrollments.id });

    if (!createdEnrollment)
        return { status: 500, body: { error: "Failed to create enrollment" } };

    const enrollment = await getEnrollmentDetails(createdEnrollment.id);

    return { status: 201, body: { data: enrollment } };
};

// Create enrollment
router.post("/", async (req, res) => {
    try {
        const { classId, studentId } = req.body;

        if (!classId || !studentId) {
            return res
                .status(400)
                .json({ error: "classId and studentId are required" });
        }

        const { status, body } = await enrollStudent(Number(classId), studentId);
        res.status(status).json(body);
    } catch (error) {
        console.error("POST /enrollments error:", error);
        res.status(500).json({ error: "Failed to create enrollment" });
    }
});

// Join class by invite code
router.post("/join", async (req, res) => {
    try {
        const { inviteCode, studentId } = req.body;

        if (!inviteCode || !studentId) {
            return res
                .status(400)
                .json({ error: "inviteCode and studentId are required" });
        }

        const [classRecord] = await db
            .select()
            .from(classes)
            .where(eq(classes.inviteCode, inviteCode));

        if (!classRecord) return res.status(404).json({ error: "Class not found" });

        const { status, body } = await enrollStudent(classRecord.id, studentId);
        res.status(status).json(body);
    } catch (error) {
        console.error("POST /enrollments/join error:", error);
        res.status(500).json({ error: "Failed to join class" });
    }
});

// Unenroll by composite (classId + studentId) — used by the class detail page
router.delete("/", async (req, res) => {
    try {
        const { classId, studentId } = req.body;

        if (!classId || !studentId) {
            return res
                .status(400)
                .json({ error: "classId and studentId are required" });
        }

        const [deleted] = await db
            .delete(enrollments)
            .where(
                and(
                    eq(enrollments.classId, Number(classId)),
                    eq(enrollments.studentId, studentId)
                )
            )
            .returning({ id: enrollments.id });

        if (!deleted) {
            return res.status(404).json({ error: "Enrollment not found" });
        }

        res.status(200).json({ data: deleted });
    } catch (error) {
        console.error("DELETE /enrollments error:", error);
        res.status(500).json({ error: "Failed to unenroll student" });
    }
});

// Unenroll by enrollment id (Refine deleteOne)
router.delete("/:id", async (req, res) => {
    try {
        const enrollmentId = Number(req.params.id);

        if (!Number.isFinite(enrollmentId)) {
            return res.status(400).json({ error: "Invalid enrollment id" });
        }

        const [deleted] = await db
            .delete(enrollments)
            .where(eq(enrollments.id, enrollmentId))
            .returning({ id: enrollments.id });

        if (!deleted) {
            return res.status(404).json({ error: "Enrollment not found" });
        }

        res.status(200).json({ data: deleted });
    } catch (error) {
        console.error("DELETE /enrollments/:id error:", error);
        res.status(500).json({ error: "Failed to unenroll student" });
    }
});

export default router;
