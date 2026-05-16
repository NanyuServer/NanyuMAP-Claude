// src/app/api/navigation/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { astar, findNearestNode } from '@/lib/astar'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { start, destinationId } = body

    if (!start || !destinationId) {
      return NextResponse.json({ error: 'Missing start or destinationId' }, { status: 400 })
    }

    // Get destination location
    const destination = await prisma.location.findUnique({
      where: { id: parseInt(destinationId) },
    })
    if (!destination) {
      return NextResponse.json({ error: 'Destination not found' }, { status: 404 })
    }

    // Get start location (by category - 北门 or 东南门)
    const startLocation = await prisma.location.findFirst({
      where: { category: start },
    })
    if (!startLocation) {
      return NextResponse.json({ error: `Start location "${start}" not found` }, { status: 404 })
    }

    // Load road graph
    const [nodes, edges] = await Promise.all([
      prisma.roadNode.findMany(),
      prisma.roadEdge.findMany(),
    ])

    if (nodes.length === 0) {
      return NextResponse.json({ error: 'No road network configured' }, { status: 400 })
    }

    // Find nearest nodes to start and destination
    const startNode = findNearestNode(nodes, startLocation.x, startLocation.y)
    const endNode = findNearestNode(nodes, destination.x, destination.y)

    if (!startNode || !endNode) {
      return NextResponse.json({ error: 'Cannot find road nodes' }, { status: 400 })
    }

    if (startNode.id === endNode.id) {
      // Same node - trivial path
      return NextResponse.json({
        path: [startNode],
        totalDistance: 0,
        startLocation,
        destination,
      })
    }

    const result = astar(nodes, edges, startNode.id, endNode.id)

    if (!result) {
      return NextResponse.json({ error: 'No path found' }, { status: 400 })
    }

    return NextResponse.json({
      path: result.nodes,
      totalDistance: result.totalDistance,
      startLocation,
      destination,
    })
  } catch (error) {
    console.error('POST /api/navigation error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
