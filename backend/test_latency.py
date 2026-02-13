#!/usr/bin/env python3
"""
Latency testing script for question generation.

Tests:
1. Question generation latency with varying context sizes
2. Completion status check latency
3. End-to-end WebSocket roundtrip time

Usage:
    python test_latency.py
"""

import asyncio
import json
import time
import statistics
from typing import Any
import websockets
from websockets.client import WebSocketClientProtocol


class LatencyTester:
    def __init__(self, ws_url: str = "ws://localhost:8000/ws"):
        self.ws_url = ws_url
        self.ws: WebSocketClientProtocol | None = None
        self.results: dict[str, list[float]] = {
            "generate_question": [],
            "completion_status": [],
            "roundtrip": [],
        }

    async def connect(self) -> None:
        """Connect to WebSocket server."""
        print(f"Connecting to {self.ws_url}...")
        self.ws = await websockets.connect(self.ws_url)
        print("✓ Connected")

    async def disconnect(self) -> None:
        """Disconnect from WebSocket server."""
        if self.ws:
            await self.ws.close()
            print("✓ Disconnected")

    async def send_and_wait(
        self, message: dict[str, Any], wait_for_type: str
    ) -> tuple[float, dict[str, Any]]:
        """Send message and measure time until response of specific type."""
        if not self.ws:
            raise RuntimeError("Not connected")

        start_time = time.perf_counter()
        await self.ws.send(json.dumps(message))

        # Wait for response
        while True:
            response_raw = await self.ws.recv()
            response = json.loads(response_raw)

            if response.get("type") == wait_for_type:
                end_time = time.perf_counter()
                latency = (end_time - start_time) * 1000  # Convert to ms
                return latency, response

            # Handle state changes and other messages
            if response.get("type") in ["state_change", "cleared"]:
                continue

            # If we get an error, still return it
            if response.get("type") == "error":
                end_time = time.perf_counter()
                latency = (end_time - start_time) * 1000
                return latency, response

    async def send_transcripts(self, num_lines: int = 10) -> None:
        """Send sample transcript lines to build context."""
        print(f"  Sending {num_lines} transcript lines...")

        sample_transcripts = [
            "We're looking for a senior backend engineer to join our team.",
            "The role will focus on building our API infrastructure.",
            "We need someone with at least 5 years of Python experience.",
            "They'll be working closely with the product team.",
            "The timeline is to have someone start within 60 days.",
            "Our tech stack includes FastAPI, PostgreSQL, and Redis.",
            "We're a 50-person startup in the fintech space.",
            "The team structure is 3 backend engineers and 2 frontend engineers.",
            "We need expertise in distributed systems and microservices.",
            "The ideal candidate should have experience with AWS.",
        ]

        for i in range(num_lines):
            transcript = sample_transcripts[i % len(sample_transcripts)]
            message = {
                "type": "transcript",
                "text": transcript,
                "speaker": "hiring_manager" if i % 2 == 0 else "recruiter",
                "timestamp": time.time(),
            }
            await self.ws.send(json.dumps(message))
            await asyncio.sleep(0.1)  # Small delay between transcripts

        print("  ✓ Transcripts sent")

    async def test_generate_question(self, context_lines: int = 10) -> float:
        """Test question generation latency with given context size."""
        print(f"\n→ Testing question generation ({context_lines} context lines)...")

        # Build context
        await self.send_transcripts(context_lines)

        # Measure question generation
        message = {"type": "generate_question"}
        latency, response = await self.send_and_wait(message, "suggestion")

        if response.get("type") == "error":
            print(f"  ✗ Error: {response.get('message')}")
            return -1

        print(f"  ✓ Latency: {latency:.2f}ms")
        print(f"  ✓ Question: {response.get('data', {}).get('question', 'N/A')[:80]}...")

        return latency

    async def test_completion_status(self) -> float:
        """Test completion status check latency."""
        print("\n→ Testing completion status check...")

        message = {"type": "get_completion_status"}
        latency, response = await self.send_and_wait(message, "completion_status")

        if response.get("type") == "error":
            print(f"  ✗ Error: {response.get('message')}")
            return -1

        status = response.get("data", {})
        print(f"  ✓ Latency: {latency:.2f}ms")
        print(f"  ✓ Progress: {status.get('progress', 0)}%")
        print(f"  ✓ Phase: {status.get('phase', 0)}")

        return latency

    async def test_roundtrip(self) -> float:
        """Test basic WebSocket roundtrip time."""
        print("\n→ Testing WebSocket roundtrip...")

        message = {"type": "clear"}
        latency, response = await self.send_and_wait(message, "cleared")

        print(f"  ✓ Latency: {latency:.2f}ms")

        return latency

    async def run_benchmark(self, iterations: int = 5) -> None:
        """Run full benchmark suite."""
        print(f"\n{'='*60}")
        print("LATENCY BENCHMARK")
        print(f"{'='*60}")
        print(f"Iterations per test: {iterations}")
        print(f"WebSocket URL: {self.ws_url}")

        await self.connect()

        try:
            # Test 1: Roundtrip time (baseline)
            print(f"\n\n{'─'*60}")
            print("TEST 1: WebSocket Roundtrip (Baseline)")
            print(f"{'─'*60}")

            for i in range(iterations):
                latency = await self.test_roundtrip()
                if latency > 0:
                    self.results["roundtrip"].append(latency)

            # Test 2: Question generation with small context (5 lines)
            print(f"\n\n{'─'*60}")
            print("TEST 2: Question Generation (Small Context - 5 lines)")
            print(f"{'─'*60}")

            for i in range(iterations):
                await self.ws.send(json.dumps({"type": "clear"}))
                await asyncio.sleep(0.1)
                latency = await self.test_generate_question(5)
                if latency > 0:
                    self.results["generate_question"].append(latency)
                await asyncio.sleep(1)  # Cooldown between tests

            # Test 3: Question generation with medium context (20 lines)
            print(f"\n\n{'─'*60}")
            print("TEST 3: Question Generation (Medium Context - 20 lines)")
            print(f"{'─'*60}")

            medium_context_results = []
            for i in range(iterations):
                await self.ws.send(json.dumps({"type": "clear"}))
                await asyncio.sleep(0.1)
                latency = await self.test_generate_question(20)
                if latency > 0:
                    medium_context_results.append(latency)
                await asyncio.sleep(1)

            # Test 4: Completion status check
            print(f"\n\n{'─'*60}")
            print("TEST 4: Completion Status Check")
            print(f"{'─'*60}")

            for i in range(iterations):
                latency = await self.test_completion_status()
                if latency > 0:
                    self.results["completion_status"].append(latency)
                await asyncio.sleep(0.5)

            # Print summary
            self.print_summary(medium_context_results)

        finally:
            await self.disconnect()

    def print_summary(self, medium_context_results: list[float]) -> None:
        """Print benchmark summary statistics."""
        print(f"\n\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}\n")

        def print_stats(name: str, values: list[float]) -> None:
            if not values:
                print(f"{name:.<40} NO DATA")
                return

            print(f"{name:.<40} {len(values)} samples")
            print(f"  {'Min':<15} {min(values):>10.2f}ms")
            print(f"  {'Max':<15} {max(values):>10.2f}ms")
            print(f"  {'Mean':<15} {statistics.mean(values):>10.2f}ms")
            print(f"  {'Median':<15} {statistics.median(values):>10.2f}ms")
            if len(values) > 1:
                print(f"  {'Std Dev':<15} {statistics.stdev(values):>10.2f}ms")
            print()

        print_stats("WebSocket Roundtrip", self.results["roundtrip"])
        print_stats(
            "Question Gen (Small - 5 lines)", self.results["generate_question"]
        )
        print_stats("Question Gen (Medium - 20 lines)", medium_context_results)
        print_stats("Completion Status Check", self.results["completion_status"])

        # Performance verdict
        print(f"{'─'*60}")
        print("PERFORMANCE VERDICT")
        print(f"{'─'*60}\n")

        if self.results["generate_question"]:
            avg_gen = statistics.mean(self.results["generate_question"])
            if avg_gen < 2000:
                print(f"✓ Question generation: EXCELLENT ({avg_gen:.0f}ms < 2000ms target)")
            elif avg_gen < 3000:
                print(
                    f"⚠ Question generation: ACCEPTABLE ({avg_gen:.0f}ms, target: <2000ms)"
                )
            else:
                print(f"✗ Question generation: SLOW ({avg_gen:.0f}ms > 3000ms)")

        if self.results["completion_status"]:
            avg_status = statistics.mean(self.results["completion_status"])
            if avg_status < 1000:
                print(f"✓ Completion status: EXCELLENT ({avg_status:.0f}ms < 1000ms)")
            elif avg_status < 2000:
                print(f"⚠ Completion status: ACCEPTABLE ({avg_status:.0f}ms)")
            else:
                print(f"✗ Completion status: SLOW ({avg_status:.0f}ms > 2000ms)")

        print()


async def main():
    """Main entry point."""
    tester = LatencyTester()

    try:
        await tester.run_benchmark(iterations=3)
    except KeyboardInterrupt:
        print("\n\nBenchmark interrupted by user")
    except Exception as e:
        print(f"\n\n✗ Error: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
