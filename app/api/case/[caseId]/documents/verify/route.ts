import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyDocuments } from "@/lib/document-verifier";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { caseId } = await params;

  // Verify case ownership
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
  });

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const result = await verifyDocuments(caseId);
    return Response.json(result);
  } catch (error) {
    console.error("[documents/verify] Error:", error);
    return new Response("Verification failed", { status: 500 });
  }
}
