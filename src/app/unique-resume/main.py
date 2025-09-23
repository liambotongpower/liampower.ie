#!/usr/bin/env python3
"""
CV Professional Summary Generator
Integrates LLM to read job postings, extract key skills, and generate bespoke professional summaries.
"""

import os
import sys
import argparse
import re
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai


class CVSummaryGenerator:
    def __init__(self):
        """Initialize the CV Summary Generator."""
        self.setup_environment()
        self.setup_gemini()
    
    def setup_environment(self):
        """Load environment variables from .env file."""
        print("🔍 DEBUG: Loading environment variables...")
        load_dotenv()
        print("✅ DEBUG: Environment loaded")
        
        # Check for API key (support both naming conventions)
        print("🔑 DEBUG: Checking for API key...")
        self.api_key = os.getenv('GOOGLE_GEMINI_API_KEY') or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            print("❌ Error: No Gemini API key found!")
            print("Available environment variables:")
            for key, value in os.environ.items():
                if 'GEMINI' in key.upper() or 'GOOGLE' in key.upper():
                    print(f"  {key}: {'*' * len(value) if value else 'None'}")
            print("Please add GOOGLE_GEMINI_API_KEY or GEMINI_API_KEY to your .env file")
            sys.exit(1)
        print(f"✅ DEBUG: API key found (length: {len(self.api_key)})")
    
    def setup_gemini(self):
        """Configure Gemini API."""
        print("🔍 DEBUG: Configuring Gemini API...")
        try:
            genai.configure(api_key=self.api_key)
            print("✅ DEBUG: Gemini API configured")
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            print("✅ DEBUG: Gemini model initialized")
            print("✅ Gemini API configured successfully")
        except Exception as e:
            print(f"❌ Error configuring Gemini API: {e}")
            print(f"❌ DEBUG: Exception type: {type(e).__name__}")
            print(f"❌ DEBUG: Exception details: {str(e)}")
            sys.exit(1)
    
    def read_job_posting(self, job_file_path):
        """Read and return job posting content from file."""
        try:
            with open(job_file_path, 'r', encoding='utf-8') as file:
                content = file.read().strip()
            if not content:
                raise ValueError("Job posting file is empty")
            print(f"✅ Successfully read job posting from {job_file_path}")
            return content
        except FileNotFoundError:
            print(f"❌ Error: Job posting file '{job_file_path}' not found")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error reading job posting: {e}")
            sys.exit(1)
    
    def read_cv(self, cv_file_path):
        """Read and return CV content from LaTeX file."""
        try:
            with open(cv_file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            print(f"✅ Successfully read CV from {cv_file_path}")
            return content
        except FileNotFoundError:
            print(f"❌ Error: CV file '{cv_file_path}' not found")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error reading CV: {e}")
            sys.exit(1)
    
    def extract_job_requirements(self, job_posting):
        """Extract key skills and action words from job posting using LLM."""
        prompt = f"""
        Analyze this job posting and extract the most important information for a professional summary:
        
        Job Posting:
        {job_posting}
        
        Please extract and return ONLY:
        1. Key technical skills and technologies mentioned
        2. Important action words and verbs used
        3. Core responsibilities and requirements
        4. Industry-specific terms
        
        Format your response as:
        TECHNICAL SKILLS: [list key technical skills]
        ACTION WORDS: [list important action words/verbs]
        KEY REQUIREMENTS: [list core responsibilities/requirements]
        INDUSTRY TERMS: [list industry-specific terms]
        
        Keep each section concise and focused on the most important elements.
        """
        
        try:
            response = self.model.generate_content(prompt)
            if response and response.text:
                print("✅ Successfully extracted job requirements")
                return response.text.strip()
            else:
                raise ValueError("LLM returned empty response")
        except Exception as e:
            print(f"❌ Error extracting job requirements: {e}")
            sys.exit(1)
    
    def generate_professional_summary(self, cv_content, job_requirements, embellishment_level):
        """Generate professional summary based on CV, job requirements, and embellishment level."""
        
        # Determine the prompt strategy based on embellishment level
        if embellishment_level == 0:
            # Pure CV-based approach
            base_prompt = f"""
            Write a professional summary based ONLY on the information provided in this CV.
            Do not add any information not explicitly mentioned in the CV.
            
            CV Content:
            {cv_content}
            
            Job Context (for reference only):
            {job_requirements}
            """
        elif embellishment_level == 10:
            # Pure LLM creativity approach
            base_prompt = f"""
            Write a compelling professional summary for a Computer Science student.
            Use the job requirements to guide the focus, but feel free to enhance and elaborate.
            Make it sound professional and impressive.
            
            Job Requirements:
            {job_requirements}
            
            CV Context (for reference):
            {cv_content}
            """
        else:
            # Balanced approach - interpolate between pure CV and creative
            cv_weight = (10 - embellishment_level) / 10
            creative_weight = embellishment_level / 10
            
            base_prompt = f"""
            Write a professional summary that balances accuracy with impact.
            Use {cv_weight*100:.0f}% CV-based information and {creative_weight*100:.0f}% creative enhancement.
            
            CV Content:
            {cv_content}
            
            Job Requirements:
            {job_requirements}
            
            Focus on the most relevant skills and experiences that match the job requirements.
            """
        
        # Add word limit constraint
        full_prompt = f"""
        {base_prompt}
        
        Requirements:
        - Maximum 90 words
        - Professional tone
        - Focus on technical skills and achievements
        - Use action words from the job posting
        - Highlight relevant experience
        - End with a strong closing statement
        
        Return ONLY the professional summary text, no additional formatting or explanations.
        """
        
        try:
            response = self.model.generate_content(full_prompt)
            if response and response.text:
                summary = response.text.strip()
                # Remove any quotes or formatting that might have been added
                summary = summary.strip('"\'')
                print("✅ Successfully generated professional summary")
                return summary
            else:
                raise ValueError("LLM returned empty response")
        except Exception as e:
            print(f"❌ Error generating professional summary: {e}")
            sys.exit(1)
    
    def sanitize_for_latex(self, text: str) -> str:
        """Escape characters and normalize punctuation to be LaTeX-safe.

        This prevents the generated text from breaking LaTeX compilation.
        """
        if not isinstance(text, str):
            return text

        # Normalize common unicode punctuation first
        normalized = (
            text.replace("\u2013", "--")   # en dash
                .replace("\u2014", "---")  # em dash
                .replace("\u2018", "'")    # left single quote
                .replace("\u2019", "'")    # right single quote
                .replace("\u201c", '"')    # left double quote
                .replace("\u201d", '"')    # right double quote
        )

        # Escape LaTeX special chars
        replacements = {
            "\\": r"\textbackslash{}",  # backslash first to avoid double-escaping
            "#": r"\#",
            "$": r"\$",
            "%": r"\%",
            "&": r"\&",
            "_": r"\_",
            "{": r"\{",
            "}": r"\}",
            "^": r"\^{}",
            "~": r"\~{}",
        }

        sanitized_chars = []
        for ch in normalized:
            sanitized_chars.append(replacements.get(ch, ch))
        sanitized = "".join(sanitized_chars)

        # Collapse excessive whitespace
        sanitized = re.sub(r"\s+", " ", sanitized).strip()
        return sanitized

    def validate_word_count(self, text, max_words=90):
        """Validate and adjust word count if necessary."""
        words = text.split()
        word_count = len(words)
        
        if word_count <= max_words:
            print(f"✅ Professional summary: {word_count} words (within limit)")
            return text
        else:
            print(f"⚠️  Professional summary: {word_count} words (exceeds {max_words} word limit)")
            # Truncate to fit word limit
            truncated = ' '.join(words[:max_words])
            print(f"✅ Truncated to: {len(truncated.split())} words")
            return truncated
    
    def insert_summary_into_cv(self, cv_content: str, professional_summary: str) -> str:
        r"""Replace the content of the PROFESSIONAL SUMMARY section with new text.

        We locate the block starting at the section header and ending just
        before the next \section{...} or \end{document}, and then replace only
        the inner content while preserving the header and following sections.
        """
        # Ensure LaTeX-safe text
        safe_summary = self.sanitize_for_latex(professional_summary)

        # Pattern with DOTALL to capture across newlines
        block_pattern = (
            r"(\\section\{PROFESSIONAL SUMMARY\}\s*\n)"  # group 1: header+newline(s)
            r"([\s\S]*?)"                                  # group 2: existing content (non-greedy)
            r"(?=\n\\section\{|\n\\end\{document\})"     # stop at next section or end document
        )

        match = re.search(block_pattern, cv_content, re.DOTALL)
        if not match:
            print("❌ Error: Could not find the PROFESSIONAL SUMMARY block in CV")
            sys.exit(1)

        header = match.group(1)
        # Compose replacement with clear spacing
        new_block = f"{header}\n{safe_summary}\n\n"
        start, end = match.span()
        updated_cv = cv_content[:start] + new_block + cv_content[end:]

        # Post-validate that the summary is present
        if safe_summary not in updated_cv:
            print("❌ Error: Summary insertion validation failed")
            sys.exit(1)

        print("✅ Successfully replaced PROFESSIONAL SUMMARY content")
        return updated_cv
    
    def save_output_cv(self, cv_content, output_path):
        """Save the updated CV to output file."""
        try:
            with open(output_path, 'w', encoding='utf-8') as file:
                file.write(cv_content)
            print(f"✅ Successfully saved updated CV to {output_path}")
        except Exception as e:
            print(f"❌ Error saving CV: {e}")
            sys.exit(1)
    
    def process(self, job_file_path, embellishment_level):
        """Main processing function."""
        print(f"🚀 Starting CV Professional Summary Generation")
        print(f"📊 Embellishment Level: {embellishment_level}/10")
        print("=" * 60)
        
        # Read inputs
        job_posting = self.read_job_posting(job_file_path)
        cv_content = self.read_cv("Input_CV.tex")
        
        # Extract job requirements
        print("\n🔍 Analyzing job posting...")
        job_requirements = self.extract_job_requirements(job_posting)
        
        # Generate professional summary
        print("\n✍️  Generating professional summary...")
        professional_summary = self.generate_professional_summary(
            cv_content, job_requirements, embellishment_level
        )
        
        # Validate word count
        professional_summary = self.validate_word_count(professional_summary)
        
        # Insert into CV
        print("\n📝 Updating CV...")
        updated_cv = self.insert_summary_into_cv(cv_content, professional_summary)
        
        # Save output
        self.save_output_cv(updated_cv, "Output_CV.tex")
        
        print("\n" + "=" * 60)
        print("🎉 CV Professional Summary Generation Complete!")
        print(f"📄 Output saved to: Output_CV.tex")
        print(f"📊 Final summary ({len(professional_summary.split())} words):")
        print("-" * 40)
        print(professional_summary)
        print("-" * 40)


def main():
    """Main function with CLI argument parsing."""
    parser = argparse.ArgumentParser(
        description="Generate bespoke professional summaries for CVs based on job postings",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py job_posting.txt --embellishment 5
  python main.py job_posting.txt -e 0    # Pure CV-based
  python main.py job_posting.txt -e 10   # Maximum creativity
        """
    )
    
    parser.add_argument(
        'job_posting_file',
        help='Path to the job posting text file'
    )
    
    parser.add_argument(
        '-e', '--embellishment',
        type=int,
        choices=range(0, 11),
        default=5,
        help='Embellishment level (0-10). 0=CV only, 10=Maximum creativity (default: 5)'
    )
    
    args = parser.parse_args()
    
    # Validate job posting file exists
    if not Path(args.job_posting_file).exists():
        print(f"❌ Error: Job posting file '{args.job_posting_file}' not found")
        sys.exit(1)
    
    # Initialize and run the generator
    generator = CVSummaryGenerator()
    generator.process(args.job_posting_file, args.embellishment)


if __name__ == "__main__":
    main()
