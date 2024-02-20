import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { Comment } from "../models/comment.model.js"
import { Like } from "../models/like.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { v2 as cloudinary } from "cloudinary";

const getAllVideos = asyncHandler(async (req, res) => {
    //TODO: get all videos based on query, sort, pagination
    const { page, limit, query, sortBy, sortType, userId } = req.query

    const sortTypeNum = Number(sortType)
    const pageNum = Number(page)
    const limitNum = Number(limit)

    if (!(sortTypeNum && pageNum && limitNum && query && sortBy && pageNum != 0)) {
        throw new ApiError(400, "Please provide a valid input")
    }

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Please provide a valid user id")
        }
    }

    const getVideos = await Video.aggregate([
        {
            $match: {
                owner: userId ? new mongoose.Types.ObjectId(userId) : { $exists: true },
                isPublished: true,
                $text: {
                    $search: query
                }
            }
        },
        {
            $addFields: {
                sortField: "$" + sortBy,
            }
        },
        // $meta can also be used with $sort
        {
            $sort: { sortField: sortTypeNum }
        },
        {
            $skip: (pageNum - 1) * limitNum
        },
        {
            $limit: limitNum
        },
        {
            $facet: {
                videos: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1,
                                        createdAt: 1,
                                        updatedAt: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ],

                matchedVideosCount: [
                    { $count: "videos" }
                ],
            }
        },
    ])

    if (!getVideos[0]?.matchedVideosCount?.length) {
        throw new ApiError(400, "No video found for the requested query. You may try a lower page number")
    }

    return res.status(200).json(new ApiResponse(200, getVideos[0], "All videos fetched successfully"))
})

const publishAVideo = asyncHandler(async (req, res) => {
    // TODO: get video, upload to cloudinary, create video
    const { title, description } = req.body
    const videoFileLocalPath = req.files?.videoFile[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path

    if (!title || title.trim() === "" || !description || description.trim() === "") {
        throw new ApiError(400, "All fields are required")
    }

    if (!(videoFileLocalPath && thumbnailLocalPath)) {
        throw new ApiError(400, "Both the video file and the thumbnail are required")
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if (!(videoFile && thumbnail)) {
        throw new ApiError(500, "Both the video file and the thumbnail are required")
    }

    const user = req.user?._id

    const uploadAVideo = await Video.create({
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        title,
        description,
        duration: videoFile.duration,
        owner: user
    })

    const uploadedVideo = await Video.findById(uploadAVideo._id)

    if (!uploadedVideo) {
        throw new ApiError(500, "Something went wrong while uploading the video")
    }

    return res.status(201).json(
        new ApiResponse(200, uploadedVideo, "Video publised successfully")
    )

})

const getVideoById = asyncHandler(async (req, res) => {
    //TODO: get video by id
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video Id")
    }

    await Video.findByIdAndUpdate(videoId, {
        $inc: { views: 1 }
    })

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId),
                isPublished: true
            }
        },
        {
            $facet: {
                getAVideo: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1,
                                        createdAt: 1,
                                        updatedAt: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ],
                totalLikesCommentsAndSubscription: [
                    {
                        $lookup: {
                            from: "likes",
                            localField: "_id",
                            foreignField: "video",
                            as: "totalLikesOnVideo"
                        }
                    },
                    {
                        $addFields: {
                            likedByUser: {
                                $in: [req.user?._id, "$totalLikesOnVideo.likedBy"]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "comments",
                            localField: "_id",
                            foreignField: "video",
                            as: "totalComments"
                        },
                    },
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "owner",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },
                    {
                        $addFields: {
                            isSubscribedTo: {
                                $in: [req.user?._id, "$subscribers.subscriber"]
                            }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            TotalLikesOnVideo: { $sum: { $size: "$totalLikesOnVideo" } },
                            TotalComments: { $sum: { $size: "$totalComments" } },
                            TotalSubscribers: { $sum: { $size: "$subscribers" } },
                            isSubscribedTo: { $first: "$isSubscribedTo" },
                            likedByUser: { $first: "$likedByUser" }
                        }
                    }
                ]
            }
        },
    ])

    if (!video[0].getAVideo.length) {
        throw new ApiError(404, "Video does not exist")
    }

    // add videoId to watchHistory of the user
    const user = await User.findById(req.user?._id)
    const matchedVideo = user.watchHistory.find((video) => video.equals(videoId));

    if (!matchedVideo) {
        user.watchHistory.push(videoId)
        await user.save();
    }

    return res.status(200).json(new ApiResponse(200, video[0], "video fetched successfully"))
})

const updateVideo = asyncHandler(async (req, res) => {
    //TODO: update video details like title, description, thumbnail

    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const { title, description } = req.body
    const thumbnailLocalPath = req.file?.path


    if (!title || title.trim() === "" || !description || !description.trim() === "" || !thumbnailLocalPath) {
        throw new ApiError(400, "All fields are required")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "No video exists for your requested query")
    }

    if (req.user?._id.toString() != video.owner.toString()) {
        throw new ApiError(400, "You are not allowed to edit this video")
    }

    let thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if (!thumbnail.url) {
        throw new ApiError(500, "Error while uploading the thumbnail and getting the URL")
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const updatedVideo = await Video.findByIdAndUpdate(
            videoId,
            {
                $set: {
                    title: title,
                    description: description,
                    thumbnail: thumbnail.url
                }
            },
            { new: true, session }
        )

        const thumbnailOldUrl = video.thumbnail
        // delete old thumbnail
        if (thumbnailOldUrl != "") {
            const getPublicId = thumbnailOldUrl.split("/").pop().split(".")[0];
            await cloudinary.uploader.destroy(getPublicId, { invalidate: true })
        }

        await session.commitTransaction();

        return res.status(200).json(new ApiResponse(200, updatedVideo, "Video updated successfully"))
    } catch (error) {
        await session.abortTransaction();
        if (thumbnail.url) {
            const getPublicIdOfNewThumbnail = thumbnail.url.split("/").pop().split(".")[0];
            cloudinary.uploader.destroy(getPublicIdOfNewThumbnail, { invalidate: true })
        }
        throw new ApiError(500, "Error while updating the thumbnail")
    } finally {
        session.endSession();
    }

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "This video does not exist")
    }

    if (req.user?._id.toString() != video.owner.toString()) {
        throw new ApiError(400, "You are not the owner to delete this video")
    }

    try {
        // delete likes on video comments
        const comments = await Comment.find({ video: video._id })
        for (const comment of comments) {
            await Like.deleteMany({ comment: comment._id });
        }
        // Delete comments and likes on the video, and then delete the video
        await Comment.deleteMany({ video: video._id });
        await Like.deleteMany({ video: video._id });
        await Video.findByIdAndDelete(videoId)


        const videoUrl = video.videoFile
        const thumbnailUrl = video.thumbnail
        if (videoUrl) {
            const getPublicIdOfVideo = videoUrl.split("/").pop().split(".")[0];
            await cloudinary.uploader.destroy(getPublicIdOfVideo, { resource_type: 'video', invalidate: true })
        }

        if (thumbnailUrl) {
            const getPublicIdOfThumbnail = thumbnailUrl.split("/").pop().split(".")[0];
            await cloudinary.uploader.destroy(getPublicIdOfThumbnail, { invalidate: true })
        }

        return res
            .status(200)
            .json(new ApiResponse(200, "Video deleted successfully"))
    } catch (error) {
        throw new ApiError(500, "Unable to delete video")
    }
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(400, "This video does not exist")
    }

    if (req.user?._id.toString() != video?.owner.toString()) {
        throw new ApiError(400, "You are not the owner to change the publish status of this video")
    }

    try {
        const updatedPublishStatus = await Video.findByIdAndUpdate(
            videoId,
            {
                $set: {
                    // if the video.isPublished is true, then applying ! makes it false, and vice versa
                    isPublished: !video.isPublished
                }
            }, { new: true }
        );

        return res.status(200).json(new ApiResponse(200, updatedPublishStatus, "Video published status changed successfully"))
    } catch (error) {
        throw new ApiError(500, "Unable to change video published status")
    }
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
