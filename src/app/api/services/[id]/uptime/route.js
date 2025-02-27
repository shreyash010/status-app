import { NextResponse } from 'next/server';
import { startOfDay, subDays, endOfDay } from 'date-fns';
import mongoose from 'mongoose';
import connectDB from "@/lib/db";
import UptimeHistory from '@/lib/models/uptimeHistory';

export async function GET(request, context) {
    try {
      await connectDB();
      const { id } = context.params; 
  
      // Validate service ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json(
          { error: "Invalid service ID format" },
          { status: 400 }
        );
      }
  
      const { searchParams } = new URL(request.url);
      const days = parseInt(searchParams.get("days") || "30");
  
      const startDate = startOfDay(subDays(new Date(), days));
      const endDate = endOfDay(new Date());
  
      const uptimeData = await UptimeHistory.aggregate([
        {
          $match: {
            serviceId: new mongoose.Types.ObjectId(id),
            timestamp: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
              status: "$status",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.date",
            statuses: {
              $push: {
                status: "$_id.status",
                count: "$count",
              },
            },
            total: { $sum: "$count" },
          },
        },
        {
          $project: {
            date: "$_id",
            uptimePercentage: {
              $cond: [
                { $eq: ["$total", 0] },
                0, // Handle days with no data
                {
                  $multiply: [
                    {
                      $divide: [
                        {
                          $sum: {
                            $map: {
                              input: {
                                $filter: {
                                  input: "$statuses",
                                  as: "s",
                                  cond: { $eq: ["$$s.status", "operational"] },
                                },
                              },
                              as: "status",
                              in: "$$status.count",
                            },
                          },
                        },
                        "$total",
                      ],
                    },
                    100,
                  ],
                },
              ],
            },
          },
        },
        { $sort: { date: 1 } },
      ]);
  
      console.log(uptimeData);
      return NextResponse.json(uptimeData);
    } catch (error) {
      console.error("Error fetching uptime data:", error);
      return NextResponse.json(
        { error: error.message || "Error fetching uptime data" },
        { status: 500 }
      );
    }
  }
  
  