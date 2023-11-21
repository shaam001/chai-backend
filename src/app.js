import expres from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = expres()

// CORS stands for Cross-Origin Resource Sharing, which is a mechanism that allows a web browser to request resources from a server on a different origin (domain, scheme, or port) than the one from which the current document was served
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(expres.json({limit: "16kb"})) // for json files
app.use(expres.urlencoded({extended: true, limit: "16kb"})) //  URL encoding converts non-ASCII characters into a format that can be transmitted over the Internet
app.use(expres.static("public")) // for static files
app.use(cookieParser())


// routes import
import userRouter from './routes/user.routes.js'


// routes declaration
app.use("/api/v1/users", userRouter)
// http://localhost:8000/api/v1/users/register

export { app }