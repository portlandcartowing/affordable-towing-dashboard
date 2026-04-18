"use server";

import { acceptProposal } from "@/lib/proposals";
import { revalidatePath } from "next/cache";

export async function acceptProposalAction(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await acceptProposal(token);

  if (result.ok) {
    // Refresh the dispatcher's views so they see the acceptance.
    revalidatePath("/call-center");
    revalidatePath("/leads");
    revalidatePath("/dashboard");
  }

  return result;
}
