// using promises
const asyncHandler = (requestHandler) => {
    (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err))
    }
}

export {asyncHandler}

/* using try catch method */

// this is how the below code works
// const assyncHandler = () => {}
// const assyncHandler = (func) => () => {}
// const assyncHandler = (func) => async () => {}

// higer order function is used here
// we are passing next because we may use middleware in future
// const assyncHandler = (fn) => async (req, res, next) => {
//     try {
//         await fn(req, res, next)
//     } catch (error) {
//         res.status(err.code || 500).json({
//             success: false,
//             message: err.message
//         })
//     }
// } 