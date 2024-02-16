import multer from "multer";

// source: multer github docs
// we are using diskstorage, as here it is a better approach
const storage = multer.diskStorage({
    destination: function (req, file, cb) { // cb stands for call back
      cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname)  // We can also add some random text to the filename, which is a good practice. This helps to avoid overwriting files with the same name and makes it easier to identify file
    }
  })
  
export const upload = multer({
    storage,
})