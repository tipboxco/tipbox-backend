"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🌱 TEST SEED STARTING...');
        try {
            const testNFT = yield prisma.nFT.create({
                data: {
                    name: 'Test NFT',
                    imageUrl: 'test.png',
                    type: 'BADGE',
                    rarity: 'COMMON',
                    isTransferable: true,
                }
            });
            console.log('✅ Test NFT created:', testNFT.id);
            const count = yield prisma.nFT.count();
            console.log('✅ Total NFTs:', count);
        }
        catch (error) {
            console.error('❌ Error:', error.message);
            throw error;
        }
    });
}
main()
    .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
