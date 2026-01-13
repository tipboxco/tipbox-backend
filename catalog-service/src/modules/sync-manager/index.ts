import { Module } from "@medusajs/framework/utils"
import SyncManagerService from "./service"

export const SYNC_MANAGER_MODULE = "syncManager"

const SyncManagerModule = Module(SYNC_MANAGER_MODULE, {
  service: SyncManagerService,
})

export default SyncManagerModule

