#!/usr/bin/env python3
"""
Simple demo to list available Gemini models and their supported methods.
Loads GOOGLE_GEMINI_API_KEY or GEMINI_API_KEY from environment or .env.
"""

import os
from dotenv import load_dotenv
import google.generativeai as genai


def main() -> None:
    load_dotenv()
    api_key = os.getenv('GOOGLE_GEMINI_API_KEY') or os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("❌ No API key found. Set GOOGLE_GEMINI_API_KEY or GEMINI_API_KEY in .env or environment.")
        return

    genai.configure(api_key=api_key)
    print("🔑 API key loaded. Querying models...\n")

    try:
        models = list(genai.list_models())
    except Exception as e:
        print(f"❌ list_models failed: {e}")
        return

    # Sort by name for stable output
    models.sort(key=lambda m: getattr(m, 'name', ''))

    print(f"Found {len(models)} models:\n")
    for m in models:
        name = getattr(m, 'name', '(unknown)')
        methods = getattr(m, 'supported_generation_methods', []) or []
        methods_str = ", ".join(methods) if methods else "(no methods listed)"
        input_tokens = getattr(getattr(m, 'input_token_limit', None), 'value', None) or getattr(m, 'input_token_limit', None)
        output_tokens = getattr(getattr(m, 'output_token_limit', None), 'value', None) or getattr(m, 'output_token_limit', None)
        print(f"- {name}")
        print(f"    methods: {methods_str}")
        if input_tokens or output_tokens:
            print(f"    input_tokens: {input_tokens}  output_tokens: {output_tokens}")
    print()

    # Highlight models that support generateContent for convenience
    supports_generate = [m.name for m in models if getattr(m, 'supported_generation_methods', None) and 'generateContent' in m.supported_generation_methods]
    if supports_generate:
        print("Models supporting generateContent:")
        for n in supports_generate:
            print(f"  • {n}")
    else:
        print("No models advertising generateContent support were returned.")


if __name__ == "__main__":
    main()


