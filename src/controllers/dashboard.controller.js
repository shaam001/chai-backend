import mongoose from "mongoose"
import { Video } from "../models/video.model.js"
import { Subscription } from "../models/subscription.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
    const user = req.user?._id

    const videoStats = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(user)
            }
        },
        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "video",
                as: "totalComments",
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "totalLikesOnVideos"
            }
        },
        {
            $group: {
                _id: null,
                TotalVideosCount: { $sum: 1 },
                TotalViewsOnVideos: { $sum: "$views" },
                TotalCommentsOnVideos: { $sum: { $size: "$totalComments" } },
                TotalLikesOnVideos: { $sum: { $size: "$totalLikesOnVideos" } }
            }
        }
    ])

    const subscriptionStats = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(user)
            }
        },
        {
            $group: {
                _id: null,
                TotalSubscribersCount: { $sum: 1 }
            }
        }
    ])

    const likesOnVideosCommentsStats = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(user)
            }
        },
        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "video",
                as: "totalComments",
            }
        },
        {
            $unwind: "$totalComments"
        },
        {
            $lookup: {
                from: "likes",
                localField: "totalComments._id",
                foreignField: "comment",
                as: "totalLikesOnVideosComments"
            }
        },
        {
            $group: {
                _id: null,
                TotalLikesOnVideoComments: { $sum: { $size: "$totalLikesOnVideosComments" } }
            }
        },
    ])


    // Combined stats using the spread operator
    const combinedStats = {
        ...videoStats[0],
        ...subscriptionStats[0],
        ...likesOnVideosCommentsStats[0]
    };

    return res.status(200).json(new ApiResponse(200, combinedStats, "Channel stats fetched successfully"))
})

const getChannelVideos = asyncHandler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel
    const user = req.user?._id
    const videos = await Video.find({ owner: user });

    if (!videos?.length) {
        throw new ApiError(404, "You haven’t uploaded a video yet.")
    }

    return res.status(200).json(new ApiResponse(200, videos, "Videos fetched successfully"))
})

export {
    getChannelStats,
    getChannelVideos
}