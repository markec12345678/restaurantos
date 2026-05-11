import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.code !== undefined) updateData.code = body.code
    if (body.basePayRate !== undefined) updateData.basePayRate = body.basePayRate
    if (body.overtimeRate !== undefined) updateData.overtimeRate = body.overtimeRate
    if (body.permissions !== undefined) updateData.permissions = body.permissions
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder

    const job = await db.job.update({
      where: { id },
      data: updateData,
      include: {
        employees: { include: { employee: { select: { id: true, name: true } } } },
      },
    })

    return NextResponse.json(job)
  } catch (error) {
    console.error('Failed to update job:', error)
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Delete related employee-job assignments first
    await db.employeeJob.deleteMany({ where: { jobId: id } })

    await db.job.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete job:', error)
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
  }
}
