import 'dotenv/config'
import { buildApp } from './app.js'
import { prisma } from './lib/prisma.js'

const port = Number(process.env.PORT ?? 4000)
const app = buildApp()

const shutdown = async () => { await app.close(); await prisma.$disconnect(); process.exit(0) }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Reservations are held only for the checkout window. This lightweight worker keeps
// expired holds from permanently reducing sellable inventory when Redis/queues are
// not available in a local or single-process deployment.
const releaseExpiredReservations = async () => {
  const expired = await prisma.inventoryReservation.findMany({
    where: { releasedAt: null, expiresAt: { lt: new Date() } },
    select: { id: true, variantId: true, locationId: true, quantity: true },
    take: 200,
  })
  for (const reservation of expired) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.inventoryReservation.updateMany({
        where: { id: reservation.id, releasedAt: null },
        data: { releasedAt: new Date() },
      })
      if (!claimed.count) return
      await tx.inventoryItem.update({
        where: { variantId_locationId: { variantId: reservation.variantId, locationId: reservation.locationId } },
        data: { reservedQty: { decrement: reservation.quantity } },
      })
      await tx.inventoryMovement.create({
        data: {
          variantId: reservation.variantId,
          locationId: reservation.locationId,
          type: 'reservation_release',
          quantity: reservation.quantity,
          reason: 'Checkout reservation expired',
        },
      })
    })
  }
}
const reservationWorker = setInterval(() => { void releaseExpiredReservations().catch((error) => app.log.error(error, 'reservation cleanup failed')) }, 60_000)
reservationWorker.unref()

app.listen({ port, host: '0.0.0.0' }).then(() => app.log.info({ port }, 'SkinFox API listening')).catch(async (error) => { app.log.error(error); await prisma.$disconnect(); process.exit(1) })
