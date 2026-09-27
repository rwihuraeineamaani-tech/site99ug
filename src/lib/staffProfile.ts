import { supabase } from "@/integrations/supabase/client";

/* Ugandan-standard staff file, with a foreign-national path. */

export type FieldDef = { key: string; label: string; type?: "text" | "date" | "number" | "select" | "textarea"; options?: string[]; required?: boolean; hint?: string };
export type Section = { id: string; title: string; table: "staff_profiles" | "staff_private" | "staff_employment"; hint?: string; fields: FieldDef[]; show?: (nationality: string) => boolean };

export const isUgandan = (n?: string | null) => !n || n.trim().toLowerCase() === "ugandan";

export const SECTIONS: Section[] = [
  { id: "personal", title: "Personal", table: "staff_profiles", fields: [
    { key: "legal_name", label: "Full legal name (as on ID/passport)", required: true },
    { key: "preferred_name", label: "Preferred name" },
    { key: "date_of_birth", label: "Date of birth", type: "date", required: true },
    { key: "gender", label: "Gender", type: "select", options: ["Female", "Male", "Prefer not to say"], required: true },
    { key: "nationality", label: "Nationality", required: true, hint: "Type 'Ugandan' or your country, e.g. Kenyan, Nigerian" },
    { key: "marital_status", label: "Marital status", type: "select", options: ["Single", "Married", "Divorced", "Widowed", "Prefer not to say"] },
  ] },
  { id: "contact", title: "Contact & home address", table: "staff_profiles", fields: [
    { key: "phone_alt", label: "Second phone" },
    { key: "personal_email", label: "Personal email" },
    { key: "district", label: "District", required: true },
    { key: "sub_county", label: "Sub-county / Division" },
    { key: "village", label: "Village / Area / LC1", required: true },
    { key: "address_line", label: "Street / plot (optional)" },
    { key: "emergency_name", label: "Emergency contact name", required: true },
    { key: "emergency_relation", label: "Relationship" },
    { key: "emergency_phone", label: "Emergency contact phone", required: true },
  ] },
  { id: "id_ug", title: "Identity (Ugandan)", table: "staff_private", hint: "Only you and HR/top management can see this.", show: isUgandan, fields: [
    { key: "nin", label: "National ID number (NIN)", required: true },
    { key: "nssf_no", label: "NSSF number" },
    { key: "tin", label: "URA TIN" },
  ] },
  { id: "id_foreign", title: "Identity (foreign national)", table: "staff_private", hint: "Only you and HR/top management can see this.", show: (n) => !isUgandan(n), fields: [
    { key: "passport_no", label: "Passport number", required: true },
    { key: "passport_country", label: "Issuing country", required: true },
    { key: "passport_expiry", label: "Passport expiry", type: "date", required: true },
    { key: "permit_class", label: "Work permit class", type: "select", options: ["Class A", "Class B", "Class C", "Class D", "Class E", "Class F", "Class G1", "Class G2", "Special pass", "Not yet issued"], required: true },
    { key: "permit_no", label: "Work permit number" },
    { key: "permit_expiry", label: "Work permit expiry", type: "date" },
    { key: "pass_no", label: "Entry / special pass number" },
    { key: "tin", label: "Uganda TIN (if any)" },
    { key: "nssf_no", label: "NSSF number (if any)" },
  ] },
  { id: "kin", title: "Next of kin", table: "staff_private", fields: [
    { key: "kin_name", label: "Name", required: true },
    { key: "kin_relation", label: "Relationship", required: true },
    { key: "kin_phone", label: "Phone", required: true },
    { key: "kin_address", label: "Address" },
  ] },
  { id: "bank", title: "Bank & mobile money", table: "staff_private", hint: "Used for salary and payments. Only you and HR/top management can see this.", fields: [
    { key: "bank_name", label: "Bank" },
    { key: "bank_branch", label: "Branch" },
    { key: "account_name", label: "Account name" },
    { key: "account_no", label: "Account number" },
    { key: "momo_network", label: "Mobile money network", type: "select", options: ["MTN", "Airtel"] },
    { key: "momo_number", label: "Mobile money number" },
  ] },
  { id: "edu", title: "Education & skills", table: "staff_profiles", fields: [
    { key: "qualification", label: "Highest qualification", type: "select", options: ["PLE", "UCE (O-Level)", "UACE (A-Level)", "Certificate", "Diploma", "Bachelor's degree", "Master's degree", "PhD", "Other"], required: true },
    { key: "institution", label: "Institution" },
    { key: "qualification_year", label: "Year completed", type: "number" },
    { key: "languages", label: "Languages spoken", hint: "e.g. English, Luganda, Swahili" },
    { key: "skills", label: "Skills", type: "textarea" },
  ] },
  { id: "health", title: "Health (optional)", table: "staff_private", hint: "Only share what the team should know in an emergency.", fields: [
    { key: "blood_group", label: "Blood group", type: "select", options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Don't know"] },
    { key: "health_notes", label: "Allergies or conditions", type: "textarea" },
  ] },
];

export const JOB_TYPES = ["Permanent", "Fixed-term", "Probation", "Part-time", "Intern", "Freelance", "Consultant", "Volunteer"] as const;

export const EMPLOYMENT: FieldDef[] = [
  { key: "start_date", label: "Start date", type: "date" },
  { key: "contract_type", label: "Job type", type: "select", options: [...JOB_TYPES], hint: "What each person must hand in changes with the job type." },
  { key: "probation_end", label: "Probation ends", type: "date" },
  { key: "contract_end", label: "Contract ends", type: "date" },
  { key: "department", label: "Department" },
  { key: "work_location", label: "Work location" },
  { key: "notice_days", label: "Notice period (days)", type: "number" },
];

export const DOC_KINDS = ["National ID / Passport", "CV", "Academic papers", "LC1 letter", "Police clearance", "Signed contract", "Work permit", "Internship letter from school", "Other"];

/** Rules per job type (Ugandan practice): what is required on top of bio data and payment details. */
type JobRule = { docs: string[]; ugFields: string[]; note: string };
const JOB_RULES: Record<string, JobRule> = {
  Permanent: { docs: ["CV", "LC1 letter", "Academic papers", "Signed contract"], ugFields: ["nssf_no", "tin"], note: "Full employee: NSSF and TIN needed for PAYE and NSSF." },
  "Fixed-term": { docs: ["CV", "LC1 letter", "Signed contract"], ugFields: ["nssf_no", "tin"], note: "Employee on a set term: NSSF and TIN needed; contract end date must be set." },
  Probation: { docs: ["CV", "LC1 letter", "Signed contract"], ugFields: ["nssf_no"], note: "On probation: NSSF needed; probation end date must be set." },
  "Part-time": { docs: ["CV", "Signed contract"], ugFields: ["nssf_no"], note: "Part-time employee: NSSF needed." },
  Intern: { docs: ["CV", "Internship letter from school"], ugFields: [], note: "Intern: no NSSF/TIN needed; the school's internship letter is." },
  Freelance: { docs: ["CV", "Signed contract"], ugFields: ["tin"], note: "Freelancer: TIN needed for withholding tax; no NSSF." },
  Consultant: { docs: ["CV", "Signed contract"], ugFields: ["tin"], note: "Consultant: TIN needed for withholding tax; no NSSF." },
  Volunteer: { docs: [], ugFields: [], note: "Volunteer: ID and bio data only." },
};
const DEFAULT_RULE: JobRule = { docs: ["CV"], ugFields: [], note: "Job type not set yet — HR should choose it." };
export const jobRule = (type?: string | null) => (type && JOB_RULES[type]) || DEFAULT_RULE;

export const requiredDocs = (n?: string | null, jobType?: string | null) => {
  const r = jobRule(jobType);
  const base = ["National ID / Passport", ...r.docs.filter((d) => isUgandan(n) || d !== "LC1 letter")];
  if (!isUgandan(n) && jobType !== "Volunteer") base.push("Work permit");
  return Array.from(new Set(base));
};

export type Row = Record<string, unknown>;
const filled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";

export type FileStatus = "good" | "partly" | "incomplete";

/** Bio data + payment details are crucial. Documents and job-type extras are a minor warning only. */
export function completeness(profile: Row | null, priv: Row | null, docs: { kind: string }[] = [], hasPrivate = true, employment: Row | null = null) {
  const nat = (profile?.nationality as string) ?? "Ugandan";
  const jobType = (employment?.contract_type as string) ?? null;
  const rule = jobRule(jobType);
  const critical: string[] = [];
  const minor: string[] = [];
  let total = 0, done = 0;
  for (const s of SECTIONS) {
    if (s.show && !s.show(nat)) continue;
    if (s.table === "staff_private" && !hasPrivate) continue;
    const src = s.table === "staff_private" ? priv : profile;
    for (const f of s.fields.filter((x) => x.required)) {
      total++;
      if (filled(src?.[f.key])) done++; else critical.push(f.label);
    }
  }
  if (hasPrivate) {
    total++;
    const bank = filled(priv?.bank_name) && filled(priv?.account_name) && filled(priv?.account_no);
    const momo = filled(priv?.momo_network) && filled(priv?.momo_number);
    if (bank || momo) done++; else critical.push("Payment details (bank account or mobile money)");
    if (isUgandan(nat)) for (const k of rule.ugFields) {
      total++;
      if (filled(priv?.[k])) done++; else minor.push(k === "nssf_no" ? "NSSF number" : "URA TIN");
    }
  }
  for (const k of requiredDocs(nat, jobType)) {
    total++;
    if (docs.some((d) => d.kind === k)) done++; else minor.push(`Document: ${k}`);
  }
  if (employment) {
    if (!jobType) minor.push("Job type (HR)");
    if (["Fixed-term", "Intern", "Freelance", "Consultant"].includes(jobType ?? "") && !filled(employment.contract_end)) minor.push("Contract end date (HR)");
    if (jobType === "Probation" && !filled(employment.probation_end)) minor.push("Probation end date (HR)");
  }
  const status: FileStatus = critical.length ? "incomplete" : minor.length ? "partly" : "good";
  return { pct: total ? Math.round((done / total) * 100) : 0, missing: [...critical, ...minor], critical, minor, status, jobType, jobNote: rule.note };
}

export const statusLabel = (s: FileStatus) => (s === "good" ? "Good" : s === "partly" ? "OK — partly done" : "Incomplete");

const t = (n: string) => supabase.from(n as never);

export async function loadFile(uid: string) {
  const [p, v, e, d] = await Promise.all([
    t("staff_profiles").select("*").eq("user_id", uid).maybeSingle(),
    t("staff_private").select("*").eq("user_id", uid).maybeSingle(),
    t("staff_employment").select("*").eq("user_id", uid).maybeSingle(),
    t("staff_documents").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
  ]);
  return {
    profile: (p.data as Row | null) ?? null,
    priv: (v.data as Row | null) ?? null,
    employment: (e.data as Row | null) ?? null,
    docs: ((d.data as unknown as { id: string; kind: string; file_path: string; file_name: string | null; created_at: string }[]) ?? []),
  };
}

export async function saveRow(table: string, uid: string, values: Row) {
  const clean: Row = { user_id: uid };
  for (const [k, v] of Object.entries(values)) clean[k] = v === "" ? null : v;
  const { error } = await t(table).upsert(clean as never, { onConflict: "user_id" });
  if (error) throw error;
}

export async function uploadDoc(uid: string, kind: string, file: File) {
  const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const up = await supabase.storage.from("staff-docs").upload(path, file);
  if (up.error) throw up.error;
  const { error } = await t("staff_documents").insert({ user_id: uid, kind, file_path: path, file_name: file.name } as never);
  if (error) throw error;
}

export async function openDoc(path: string) {
  const { data, error } = await supabase.storage.from("staff-docs").createSignedUrl(path, 120);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}

export async function uploadAvatar(uid: string, file: File) {
  const path = `${uid}/avatar-${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
  const up = await supabase.storage.from("staff-docs").upload(path, file, { upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase.from("team_members").update({ avatar_url: path } as never).eq("user_id", uid);
  if (error) throw error;
  return path;
}

export async function avatarUrls(paths: string[]) {
  const list = paths.filter(Boolean);
  if (!list.length) return new Map<string, string>();
  const { data } = await supabase.storage.from("staff-docs").createSignedUrls(list, 3600);
  return new Map((data ?? []).filter((x) => x.signedUrl).map((x) => [x.path as string, x.signedUrl]));
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}
