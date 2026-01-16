import { defineMiddlewares } from "@medusajs/framework/http"
import multer from "multer"

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10, // Max 10 files
  },
})

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/media",
      method: ["POST"],
      // 10MB gibi bir limit verelim
      bodyParser: { sizeLimit: "25mb" },
      middlewares: [
        // form-data'da "file" alanı ile tek dosya
        // birden fazla ise upload.array("files")
        // @ts-ignore
        upload.single("file"),
      ],
    },
  ],
})