import { redirect } from "next/navigation"
export default function ReturningVisitorRedirect(){
  // Phone-only record lookup could disclose a prior visitor's identity.
  // Returning visitors re-enter details until a verified account retrieval flow is available.
  redirect("/pre-register?returning=1")
}
