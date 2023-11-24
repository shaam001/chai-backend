// require('dotenv').config({path: './env'})
// to use import for dotenv we have to set config as done below and add "-r dotenv/config --experimental-json-modules" in dev scripts after "nodemon" in package.json so that we can use this experimental feature, in future versions it may not require
import dotenv from "dotenv"
import connectDB from "./db/index.js";
import {app} from './app.js'

dotenv.config({
    path: './.env'
})


connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at port : ${process.env.PORT}`);
    })
    app.on("error", (error) => {
        console.log("ERROR: ", error);
        throw error
    })
})
.catch((err) =>{
    console.log("MONGO db connection failed !!! ", err);
})


/* 
//not a professional approach
// we can also write programs to connect database within the index.js but this may mess your index.js file so better create a seprate file to write program about database 
*/
/*
import express from "express"
const app = express()
( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("errror", (error) => {
            console.log("ERRR: ", error);
            throw error
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is listening on port ${process.env.PORT}`);
        })

    } catch (error) {
        console.error("ERROR: ", error)
        throw err
    }
})()

*/

// we will app.use when we need to use middleware and configuration settings
// (req, res) is not the only elements we have (err, req, res, next)