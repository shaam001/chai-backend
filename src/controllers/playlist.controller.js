import mongoose, { isValidObjectId } from "mongoose"
import { Playlist } from "../models/playlist.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body
    //TODO: create playlist
    if (!name || name.trim() === "" || !description || description.trim() === "") {
        throw new ApiError(400, "All fields are required")
    }

    const user = req.user?._id

    const playlist = await Playlist.create({
        name,
        description,
        owner: user
    })

    const createdPlaylist = await Playlist.findById(playlist._id)

    if (!createdPlaylist) {
        throw new ApiError(500, "Something went wrong while creating a playlist")
    }

    return res.status(201).json(new ApiResponse(200, createdPlaylist, "Playlist created successfully"))
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params
    //TODO: get user playlists
    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user id")
    }

    const user = await User.findById(userId)

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    const userPlaylist = await Playlist.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(user)
            }
        }
    ])

    if (!userPlaylist.length) {
        throw new ApiError(404, "This user does not have any playlist")
    }

    return res.status(200).json(new ApiResponse(200, userPlaylist, "Playlists of the user have been fetched successfully"))

})

const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    //TODO: get playlist by id

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist id")
    }

    const playlist = await Playlist.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(playlistId)
            }
        },
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
                            avatar: 1
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
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                },
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
                ]
            }
        }
    ])

    if (!playlist?.length) {
        throw new ApiError(400, "This playlist does not exist")
    }

    return res.status(200).json(new ApiResponse(200, playlist[0], "Playlist fetched successfully"))
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlist or video id")
    }

    const playlist = await Playlist.findById(playlistId)

    if (!playlist) {
        throw new ApiError(404, "This playlist does not exist")
    }

    if (playlist.owner.toString() != (req.user._id).toString()) {
        throw new ApiError(400, "You are not the owner of this playlist to add a video")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "video does not exist ")
    }

    const matchedVideo = playlist.videos.find((video) => video.equals(videoId));
    if (matchedVideo) {
        throw new ApiError(400, "Video already exists in the playlist");
    }

    try {
        playlist.videos.push(video);
        const updatedPlaylist = await playlist.save();

        return res.status(200).json(new ApiResponse(200, updatedPlaylist, "Video added to playlist successfully"))
    } catch (error) {
        throw new ApiError(500, "Unable to add video to the playlist")
    }

})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params
    // TODO: remove video from playlist
    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlist id or video id")
    }

    const playlist = await Playlist.findById(playlistId)

    if (!playlist) {
        throw new ApiError(404, "This playlist does not exist")
    }

    if (playlist.owner.toString() != (req.user._id).toString()) {
        throw new ApiError(400, "You are not the owner of this playlist to remove a video")
    }

    const matchedVideo = playlist.videos.find((video) => video.equals(videoId));
    if (!matchedVideo) {
        throw new ApiError(400, "No video matched with this video id");
    }

    try {
        playlist.videos.pull(videoId);
        const updatedPlaylist = await playlist.save()

        return res.status(200).json(new ApiResponse(200, updatedPlaylist, "Video deleted from the playlist successfully"))
    } catch (error) {
        throw new ApiError(500, "Unable to delete this video from the playlist")
    }
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    // TODO: delete playlist
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist id")
    }

    const playlist = await Playlist.findById(playlistId)

    if (!playlist) {
        throw new ApiError(404, "This playlist does not exist")
    }

    if (playlist.owner.toString() != req.user?._id.toString()) {
        throw new ApiError(400, "You are not the owner of this playlist")
    }

    try {
        await Playlist.findByIdAndDelete(playlistId)

        return res
            .status(200)
            .json(new ApiResponse(200, "Playlist deleted successfully"))
    } catch (error) {
        throw new ApiError(500, "Unable to delete playlist")
    }
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const { name, description } = req.body
    //TODO: update playlist
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist id")
    }

    if (!name || name.trim() === "" || !description || description.trim() === "") {
        throw new ApiError(400, "All fields are required")
    }

    const playlist = await Playlist.findById(playlistId)

    if (!playlist) {
        throw new ApiError(404, "This playlist does not exist")
    }

    if (playlist.owner.toString() != (req.user._id).toString()) {
        throw new ApiError(400, "You are not the owner to update this playlist")
    }

    try {
        const updatedPlaylist = await Playlist.findByIdAndUpdate(
            playlistId,
            {
                $set: {
                    name,
                    description
                }
            }, { new: true }
        )

        return res.status(200).json(new ApiResponse(200, updatedPlaylist, "Playlist updated successfully"))
    } catch (error) {
        throw new ApiError(500, "Unable to update playlist")
    }
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}
