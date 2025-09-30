import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure Python workflow files are included in the serverless trace
  // so they are present in the deployed bundle for copying to /tmp
  outputFileTracingIncludes: {
    "./src/app/unique-resume/actions.ts": [
      "./src/app/unique-resume/main.py",
      "./src/app/unique-resume/requirements.txt",
      "./src/app/unique-resume/Input_CV.tex"
    ],
    "./src/app/unique-resume/page.tsx": [
      "./src/app/unique-resume/main.py",
      "./src/app/unique-resume/requirements.txt",
      "./src/app/unique-resume/Input_CV.tex"
    ]
  }
};

export default nextConfig;
