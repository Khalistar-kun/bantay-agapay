// One-time script to create the first admin account.
// Usage: node scripts/create-admin.js "Full Name" "09171234567" "yourpassword"

const { createClient } = require("@supabase/supabase-js")
const bcrypt = require("bcryptjs")
require("dotenv").config({ path: ".env.local" })

async function main() {
  const [fullName, phoneNumber, password] = process.argv.slice(2)

  if (!fullName || !phoneNumber || !password) {
    console.error('Usage: node scripts/create-admin.js "Full Name" "09171234567" "yourpassword"')
    process.exit(1)
  }

  if (password.length < 6) {
    console.error("Password must be at least 6 characters")
    process.exit(1)
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const digits = phoneNumber.replace(/\D/g, "")
  const normalized = digits.startsWith("63") && digits.length === 12 ? "0" + digits.slice(2) : digits.length === 10 ? "0" + digits : digits

  const passwordHash = await bcrypt.hash(password, 10)

  const { error } = await supabase.from("profiles").insert({
    full_name: fullName,
    phone_number: normalized,
    password_hash: passwordHash,
    role: "ADMIN",
    active: true,
  })

  if (error) {
    console.error("Failed to create admin:", error.message)
    process.exit(1)
  }

  console.log(`✓ Admin account created for ${fullName} (${normalized})`)
  console.log("You can now log in at /login with this phone number and password.")
}

main()
