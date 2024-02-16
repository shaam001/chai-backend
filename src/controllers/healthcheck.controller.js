import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"


const healthcheck = asyncHandler(async (req, res) => {
    //TODO: build a healthcheck response that simply returns the OK status as json with a message
    try {
        await User.findOne();
        return res.status(200).json(new ApiResponse(200, "Ok"))
    } catch (error) {
        throw new ApiError(500, "Not Ok")
    }
})

export {
    healthcheck
}