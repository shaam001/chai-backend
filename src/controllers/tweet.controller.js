import mongoose, { isValidObjectId } from "mongoose"
import { Tweet } from "../models/tweet.model.js"
import { Like } from "../models/like.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create 
    const { content } = req.body

    if (!content || content.trim() === "") {
        throw new ApiError(400, "Content can't be empty")
    }

    const user = req.user?._id

    const tweet = await Tweet.create({
        content,
        owner: user
    })

    const createdTweet = await Tweet.findById(tweet._id)

    if (!createdTweet) {
        throw new ApiError(500, "Something went wrong while creating the tweet in the database")
    }

    return res.status(201).json(
        new ApiResponse(200, createdTweet, "Your tweet has been posted successfully")
    )

})

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
    const { userId } = req.params

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid tweet id")
    }

    const tweet = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "tweetLikedBy"
            }
        },
        {
            $group: {
                _id: "$_id",
                content: { $first: "$content" },
                owner: { $first: "$owner" },
                createdAt: { $first: "$createdAt" },
                updatedAt: { $first: "$updatedAt" },
                totalTweetLikes: { $sum: { $size: "$tweetLikedBy" } }
            }
        },
        { $sort: { _id: 1 } }
    ])

    if (!tweet?.length) {
        throw new ApiError(404, "Tweet does not exist")
    }

    const tweetedBy = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $addFields: {
                isTweetOwner: {
                    $cond: {
                        if: { $eq: [req.user?._id.toString(), userId] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                username: 1,
                fullName: 1,
                avatar: 1,
                createdAt: 1,
                updatedAt: 1,
                isTweetOwner: 1
            }
        }
    ])

    const tweetAndDetails = {
        tweet,
        tweetedBy
    }

    return res
        .status(200)
        .json(new ApiResponse(200, tweetAndDetails, "tweets fetched successfully"))
})

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const { tweetId } = req.params
    const { content } = req.body

    if (!content || content.trim() === "") {
        throw new ApiError(400, "Content can't be empty")
    }

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet id")
    }

    const tweetOwner = await Tweet.findById(tweetId)

    if (!tweetOwner) {
        throw new ApiError(404, "Tweet id does not exist")
    }

    if (tweetOwner.owner.toString() != req.user?._id.toString()) {
        throw new ApiError(400, "You are not the owner of this tweet to edit")
    }
    const tweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content: content
            }
        },
        { new: true }
    )

    return res.status(200).json(new ApiResponse(200, tweet, "tweet updated successfully"))

})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
    const { tweetId } = req.params

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet id")
    }

    const tweet = await Tweet.findById(tweetId)

    if (!tweet) {
        throw new ApiError(404, "this tweet does not exist")
    }

    if (tweet.owner.toString() != req.user?._id.toString()) {
        throw new ApiError(400, "You are not the owner of this tweet to delete")
    }

    try {
        await Tweet.findByIdAndDelete(tweetId)
        // delete likes of deleted tweet
        await Like.deleteMany({ tweet: tweet._id });

        return res
            .status(200)
            .json(new ApiResponse(200, "tweet deleted successfully"))
    } catch (error) {
        throw new ApiError(500, "Unable to delete tweet")
    }
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}
