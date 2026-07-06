import PosStaff from "@/models/PosStaff";
import PosClient from "@/models/PosClient";
import PosReceptionist from "@/models/PosReceptionist";
import PosAccountant from "@/models/PosAccountant";
import PosAppointment from "@/models/PosAppointment";
import {
  INITIAL_STAFF,
  INITIAL_CLIENTS,
  INITIAL_RECEPTIONISTS,
  INITIAL_ACCOUNTANTS,
} from "@/components/pos/data";
import { getTodaySpanishShortDate, getMexicoDateYMD } from "@/components/pos/scheduleUtils";
import {
  getAllowedServiceIdsForStaffCode,
  syncStaffAllowedServices,
  syncStaffLoginCodes,
  DEFAULT_STAFF_PINS,
} from "@/libs/posStaffServices";

export async function seedPosStaffIfEmpty() {
  const count = await PosStaff.countDocuments();

  if (count > 0) {
    return false;
  }

  await PosStaff.insertMany(
    INITIAL_STAFF.map((member) => ({
      staffCode: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role,
      status: member.status,
      rating: member.rating,
      specialty: member.specialty,
      shift: member.shift,
      completedToday: member.completedToday,
      totalToday: member.totalToday,
      weeklyRevenue: member.weeklyRevenue,
      commissionPercent: member.commissionPercent,
      bio: member.bio,
      image: member.image,
      color: member.color,
      colorLight: member.colorLight,
      allowedServiceIds: getAllowedServiceIdsForStaffCode(member.id),
      loginCode: DEFAULT_STAFF_PINS[member.id] || "1234",
    }))
  );

  return true;
}

export async function seedPosClientsIfEmpty() {
  if (INITIAL_CLIENTS.length === 0) {
    return false;
  }

  const count = await PosClient.countDocuments();

  if (count > 0) {
    return false;
  }

  await PosClient.insertMany(
    INITIAL_CLIENTS.map((client) => ({
      clientCode: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      birthday: client.birthday,
      address: client.address,
      isPlatinum: client.isPlatinum,
      memberSince: client.memberSince,
      bio: client.bio,
      styleProfile: client.styleProfile,
      alerts: client.alerts,
      totalSpent: client.totalSpent,
      visitsCount: client.visitsCount,
      averageTicket: client.averageTicket,
    }))
  );

  return true;
}

/** Sincroniza fotos locales (/staff/...) desde INITIAL_STAFF hacia MongoDB. */
export async function syncStaffLocalImages() {
  const localImages = INITIAL_STAFF.filter((member) =>
    member.image?.startsWith("/staff/")
  );

  for (const member of localImages) {
    await PosStaff.updateOne(
      { staffCode: member.id },
      { $set: { image: member.image } }
    );
  }
}

export async function seedPosAccountantIfEmpty() {
  for (const member of INITIAL_ACCOUNTANTS) {
    await PosAccountant.updateOne(
      { accountantCode: member.id },
      {
        $set: {
          name: member.name,
          role: member.role,
          loginCode: member.loginCode,
          email: member.email || "",
          phone: member.phone || "",
          isActive: true,
        },
      },
      { upsert: true }
    );
  }
}

export async function seedPosReceptionistsIfEmpty() {
  for (const member of INITIAL_RECEPTIONISTS) {
    await PosReceptionist.updateOne(
      { receptionistCode: member.id },
      {
        $set: {
          name: member.name,
          role: member.role,
          loginCode: member.loginCode,
          image: member.image,
          color: member.color,
          colorLight: member.colorLight,
        },
        $setOnInsert: {
          bookingsToday: 0,
          bookingsTodayDate: "",
        },
      },
      { upsert: true }
    );
  }
}

export async function syncReceptionistLoginCodes() {
  for (const member of INITIAL_RECEPTIONISTS) {
    await PosReceptionist.updateOne(
      { receptionistCode: member.id },
      { $set: { loginCode: member.loginCode } }
    );
  }
}

export async function refreshReceptionistDailyCounts(todayLabel = getTodaySpanishShortDate()) {
  const mexicoYMD = getMexicoDateYMD();
  const receptionists = await PosReceptionist.find();

  for (const receptionist of receptionists) {
    const [result] = await PosAppointment.aggregate([
      {
        $match: {
          bookedByReceptionistId: receptionist.receptionistCode,
        },
      },
      {
        $addFields: {
          mxCreatedDay: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "America/Mexico_City",
            },
          },
        },
      },
      {
        $match: {
          $or: [{ bookedOnDate: todayLabel }, { mxCreatedDay: mexicoYMD }],
        },
      },
      { $count: "total" },
    ]);

    const count = result?.total ?? 0;

    await PosReceptionist.updateOne(
      { receptionistCode: receptionist.receptionistCode },
      {
        $set: {
          bookingsToday: count,
          bookingsTodayDate: todayLabel,
        },
      }
    );
  }
}
