import PosStaff from "@/models/PosStaff";
import { INITIAL_SERVICES, INITIAL_STAFF } from "@/components/pos/data";
import { STAFF_CATALOG_TEMPLATE_BY_ROLE } from "@/components/pos/staffColors";

export const DEFAULT_STAFF_PINS = {
  CA: "1111",
  DI: "2222",
  KE: "3333",
  DE: "4444",
  VE: "5555",
  DA: "6666",
  VN: "7777",
};

export function getAllowedServiceIdsForStaffCode(staffCode) {
  return INITIAL_SERVICES.filter((service) =>
    service.staffIds.includes(staffCode)
  ).map((service) => service.id);
}

export function getAllowedServiceIdsForRole(role, staffName = "") {
  const templateId =
    STAFF_CATALOG_TEMPLATE_BY_ROLE[role] ||
    (staffName.toLowerCase() === "vanny" ? "CA" : undefined);

  if (!templateId) return [];

  return getAllowedServiceIdsForStaffCode(templateId);
}

export async function syncStaffAllowedServices() {
  for (const member of INITIAL_STAFF) {
    const allowedServiceIds = getAllowedServiceIdsForStaffCode(member.id);

    await PosStaff.updateOne(
      { staffCode: member.id },
      { $set: { allowedServiceIds } }
    );
  }

  const staffWithoutServices = await PosStaff.find({
    $or: [
      { allowedServiceIds: { $exists: false } },
      { allowedServiceIds: { $size: 0 } },
    ],
  });

  for (const doc of staffWithoutServices) {
    const allowedServiceIds = getAllowedServiceIdsForRole(doc.role, doc.name);

    if (allowedServiceIds.length > 0) {
      await PosStaff.updateOne(
        { _id: doc._id },
        { $set: { allowedServiceIds } }
      );
    }
  }
}

export async function syncStaffLoginCodes() {
  for (const [staffCode, loginCode] of Object.entries(DEFAULT_STAFF_PINS)) {
    await PosStaff.updateOne({ staffCode }, { $set: { loginCode } });
  }

  await PosStaff.updateMany(
    {
      $or: [
        { loginCode: { $exists: false } },
        { loginCode: "" },
        { loginCode: null },
      ],
    },
    { $set: { loginCode: "1234" } }
  );
}

export function resolveAllowedServiceIdsForNewStaff(body = {}) {
  if (Array.isArray(body.allowedServiceIds) && body.allowedServiceIds.length > 0) {
    return body.allowedServiceIds;
  }

  const staffCode = String(body.staffCode || "").trim().toUpperCase();
  const fromCode = getAllowedServiceIdsForStaffCode(staffCode);

  if (fromCode.length > 0) return fromCode;

  return getAllowedServiceIdsForRole(body.role || "", body.name || "");
}
