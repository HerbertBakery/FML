// app/api/admin/chips/update/route.ts
//
// POST /api/admin/chips/update
// Updates an existing ChipTemplate with any provided fields.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { requireAdminSecret } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdminSecret(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // OPTIONAL: add admin check later
    // if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();

    const {
      id, // required
      name,
      description,
      conditionType,
      minRarity,
      maxRarity,
      allowedPositions,
      isActive,
      // NEW: extra fields
      parameterInt,
      maxTries,
      isInShop,
      shopPrice,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Chip template id is required." },
        { status: 400 }
      );
    }

    const existing = await prisma.chipTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: `Chip template not found.` },
        { status: 404 }
      );
    }

    // Small safety on maxTries + shop fields
    let data: any = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(conditionType !== undefined && { conditionType }),
      ...(minRarity !== undefined && { minRarity }),
      ...(maxRarity !== undefined && { maxRarity }),
      ...(allowedPositions !== undefined && { allowedPositions }),
      ...(isActive !== undefined && { isActive }),
    };

    if (parameterInt !== undefined) {
      data.parameterInt =
        typeof parameterInt === "number" && !Number.isNaN(parameterInt)
          ? parameterInt
          : null;
    }

    if (maxTries !== undefined) {
      const n = Number(maxTries);
      if (!Number.isNaN(n) && n >= 1) {
        data.maxTries = Math.floor(n);
      }
    }

    if (isInShop !== undefined || shopPrice !== undefined) {
      // If either is sent, we recompute both
      let safeIsInShop = existing.isInShop;
      let safeShopPrice = existing.shopPrice;

      if (typeof isInShop === "boolean") {
        safeIsInShop = isInShop;
      }

      if (shopPrice !== undefined) {
        const n = Number(shopPrice);
        if (!Number.isNaN(n) && n > 0) {
          safeShopPrice = Math.floor(n);
        } else {
          safeShopPrice = null;
          safeIsInShop = false;
        }
      }

      data.isInShop = safeIsInShop;
      data.shopPrice = safeShopPrice;
    }

    const updated = await prisma.chipTemplate.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      message: "Chip template updated.",
      chip: updated,
    });
  } catch (err: any) {
    console.error("Error updating chip template:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to update chip template." },
      { status: 500 }
    );
  }
}
