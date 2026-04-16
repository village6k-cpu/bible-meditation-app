#!/usr/bin/env python3
"""
advisor 툴 최소 테스트. 실제로 동작하는지 확인.

사용법:
  pip3 install --upgrade anthropic
  python3 scripts/rag/test_advisor.py
"""

import sys

# SDK 버전 확인
try:
    import anthropic
    print(f"anthropic SDK 버전: {anthropic.__version__}")
except ImportError:
    print("anthropic SDK가 설치되어 있지 않습니다.")
    sys.exit(1)

# 버전 파싱 (0.93.0 이상 필요)
try:
    major, minor, patch = (int(x) for x in anthropic.__version__.split(".")[:3])
    if (major, minor) < (0, 93):
        print(f"⚠ 0.93.0 이상 필요. 현재: {anthropic.__version__}")
        print("  pip3 install --upgrade anthropic")
        sys.exit(1)
except Exception:
    pass

print("\n── advisor 툴 테스트 시작 ──\n")

client = anthropic.Anthropic()

try:
    response = client.beta.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        tools=[{
            "type": "advisor_20260301",
            "name": "advisor",
            "model": "claude-opus-4-6",
            "max_uses": 1,
        }],
        messages=[{"role": "user", "content": "Say hello"}],
        betas=["advisor-tool-2026-03-01"],
    )
    print("✓ 호출 성공\n")
    print(f"stop_reason: {response.stop_reason}")
    print(f"usage: {response.usage}")
    print(f"\ncontent 블록 수: {len(response.content)}")
    for i, block in enumerate(response.content):
        print(f"\n[블록 {i}] type={block.type}")
        if block.type == "text":
            print(f"  text: {block.text[:300]}")
        elif block.type == "tool_use":
            print(f"  name: {block.name}")
            print(f"  input: {block.input}")
        elif block.type == "tool_result":
            print(f"  content: {str(block.content)[:300]}")
        else:
            print(f"  (알 수 없는 블록 타입)")
            print(f"  raw: {block}")

except Exception as e:
    print(f"✗ 호출 실패: {type(e).__name__}")
    print(f"  메시지: {e}")
    sys.exit(1)
