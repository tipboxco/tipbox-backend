#!/usr/bin/env ts-node

/**
 * Versiyon numarasını otomatik olarak artırır
 * Patch versiyonu artırır: 0.0.1 -> 0.0.2 -> ... -> 0.0.9 -> 0.1.0
 * Patch 9 olduğunda minör artar: 0.0.9 -> 0.1.0, 0.1.9 -> 0.2.0
 * Minör 9 olduğunda major artar: 0.9.9 -> 1.0.0
 * 1.0.0'a ulaştığında durur (manuel müdahale gerekir)
 */

import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const packageJsonPath = path.join(projectRoot, 'package.json');

interface PackageJson {
  version: string;
  [key: string]: any;
}

function parseVersion(version: string): { major: number; minor: number; patch: number } {
  // Versiyon formatını normalize et (0.1.00 -> 0.1.0)
  const normalized = version.replace(/\.0+$/, ''); // Sondaki .00'ları temizle
  const parts = normalized.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

function formatVersion(version: { major: number; minor: number; patch: number }): string {
  // Standart npm versiyon formatı: X.Y.Z
  return `${version.major}.${version.minor}.${version.patch}`;
}

function bumpPatchVersion(version: string): string {
  const parsed = parseVersion(version);
  
  // Eğer major 1.0.0 veya üzerindeyse, artırma yapma
  if (parsed.major >= 1) {
    console.log(`⚠️  Versiyon ${version} zaten 1.0.0 veya üzerinde. Manuel müdahale gerekli.`);
    return version;
  }
  
  // Patch versiyonu artır
  parsed.patch += 1;
  
  // Eğer patch 10'a ulaşırsa (0.0.9 -> 0.1.0)
  if (parsed.patch >= 10) {
    parsed.patch = 0;
    parsed.minor += 1;
    
    // Eğer minor 10'a ulaşırsa (0.9.9 -> 1.0.0)
    if (parsed.minor >= 10) {
      parsed.major = 1;
      parsed.minor = 0;
    }
  }
  
  return formatVersion(parsed);
}

function main() {
  try {
    // package.json'ı oku
    if (!fs.existsSync(packageJsonPath)) {
      console.error('❌ package.json bulunamadı:', packageJsonPath);
      process.exit(1);
    }
    
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson: PackageJson = JSON.parse(packageJsonContent);
    
    const currentVersion = packageJson.version;
    console.log(`📦 Mevcut versiyon: ${currentVersion}`);
    
    // Versiyonu artır (patch tabanlı: 0.0.1 -> 0.0.2 -> ... -> 0.0.9 -> 0.1.0)
    const newVersion = bumpPatchVersion(currentVersion);
    
    if (newVersion === currentVersion) {
      console.log('ℹ️  Versiyon değişmedi.');
      process.exit(0);
    }
    
    // package.json'ı güncelle
    packageJson.version = newVersion;
    
    // package.json'ı yaz (formatı koruyarak)
    const updatedContent = JSON.stringify(packageJson, null, 2) + '\n';
    fs.writeFileSync(packageJsonPath, updatedContent, 'utf8');
    
    console.log(`✅ Versiyon güncellendi: ${currentVersion} -> ${newVersion}`);
    console.log(`📝 package.json güncellendi: ${packageJsonPath}`);
    
    // Yeni versiyonu stdout'a yazdır (GitHub Actions için)
    console.log(`::set-output name=new_version::${newVersion}`);
    process.stdout.write(`NEW_VERSION=${newVersion}\n`);
    
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

main();

