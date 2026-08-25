const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");

// --- Public (QR Menu) ---

async function createFeedback(storeId, input) {
  const prisma = getPrismaClient();
  const { orderId, rating, comment } = input;

  if (!rating || rating < 1 || rating > 5) {
    throw createHttpError(400, "Valid rating (1-5) is required");
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { googleReviewUrl: true }
  });

  if (!store) {
    throw createHttpError(404, "Store not found");
  }

  // The Gatekeeper Logic
  const isPublic = rating >= 4;

  const feedback = await prisma.feedback.create({
    data: {
      storeId,
      orderId: orderId || null,
      rating,
      comment,
      isPublic
    }
  });

  if (isPublic && store.googleReviewUrl) {
    return {
      success: true,
      message: "We're so glad you enjoyed! Please consider sharing your experience.",
      promptReview: true,
      googleReviewUrl: store.googleReviewUrl,
      feedback
    };
  }

  // Negative review handling or missing review url
  return {
    success: true,
    message: "Thank you for your feedback. We appreciate your input and will use it to improve.",
    promptReview: false,
    feedback
  };
}

// --- Staff (Manager) ---

async function getFeedback(storeId) {
  const prisma = getPrismaClient();
  return prisma.feedback.findMany({
    where: { storeId },
    include: {
      order: {
        select: {
          id: true,
          table: { select: { tableNumber: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

module.exports = {
  createFeedback,
  getFeedback
};
