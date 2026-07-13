import PosExpense from "@/models/PosExpense";
import PosSupplier from "@/models/PosSupplier";
import PosInventoryItem from "@/models/PosInventoryItem";
import PosPurchase from "@/models/PosPurchase";
import PosPayable from "@/models/PosPayable";

async function nextSequentialCode(Model, field, prefix) {
  const latest = await Model.findOne()
    .sort({ createdAt: -1 })
    .select(field)
    .lean();

  const current = String(latest?.[field] || "");
  const match = current.match(new RegExp(`^${prefix}-(\\d+)$`));
  const next = match ? Number(match[1]) + 1 : 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

export async function generateNextExpenseCode() {
  return nextSequentialCode(PosExpense, "expenseCode", "GAS");
}

export async function generateNextSupplierCode() {
  return nextSequentialCode(PosSupplier, "supplierCode", "PROV");
}

export async function generateNextInventoryItemCode() {
  return nextSequentialCode(PosInventoryItem, "itemCode", "INV");
}

export async function generateNextPurchaseCode() {
  return nextSequentialCode(PosPurchase, "purchaseCode", "COM");
}

export async function generateNextPayableCode() {
  return nextSequentialCode(PosPayable, "payableCode", "CPP");
}
