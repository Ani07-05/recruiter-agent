#!/usr/bin/env python3
"""
Real-time performance monitor for question generation.

Displays live latency metrics while the app is running.
Useful for monitoring performance during development/testing.

Usage:
    python monitor_performance.py
"""

import asyncio
import json
import time
from datetime import datetime
from collections import deque
import websockets


class PerformanceMonitor:
    def __init__(self, ws_url: str = "ws://localhost:8000/ws"):
        self.ws_url = ws_url
        self.ws = None
        self.latencies = deque(maxlen=50)  # Keep last 50 measurements
        self.question_count = 0
        self.start_time = time.time()

    async def connect(self) -> None:
        """Connect to WebSocket server."""
        print(f"🔌 Connecting to {self.ws_url}...")
        self.ws = await websockets.connect(self.ws_url)
        print("✓ Connected\n")

    async def monitor(self) -> None:
        """Monitor WebSocket messages and track performance."""
        print("📊 Performance Monitor Active")
        print("─" * 60)
        print("Listening for messages... (Press Ctrl+C to stop)\n")

        last_request_time = None
        message_type = None

        try:
            async for message_raw in self.ws:
                message = json.loads(message_raw)
                msg_type = message.get("type")
                timestamp = datetime.now().strftime("%H:%M:%S")

                # Track state changes
                if msg_type == "state_change":
                    state = message.get("state")
                    print(f"[{timestamp}] 🔄 State: {state}")

                    if state == "generating":
                        last_request_time = time.time()
                        message_type = "question"

                # Track suggestion responses (question generated)
                elif msg_type == "suggestion":
                    if last_request_time:
                        latency = (time.time() - last_request_time) * 1000
                        self.latencies.append(latency)
                        self.question_count += 1

                        # Performance indicator
                        if latency < 2000:
                            indicator = "🟢 FAST"
                        elif latency < 3000:
                            indicator = "🟡 OK  "
                        else:
                            indicator = "🔴 SLOW"

                        question_text = message.get("data", {}).get("question", "")
                        print(f"[{timestamp}] {indicator} Question generated in {latency:.0f}ms")
                        print(f"            {question_text[:70]}...")

                        # Show rolling stats
                        if len(self.latencies) >= 3:
                            avg = sum(self.latencies) / len(self.latencies)
                            min_val = min(self.latencies)
                            max_val = max(self.latencies)
                            print(f"            📈 Stats: avg={avg:.0f}ms, min={min_val:.0f}ms, max={max_val:.0f}ms")

                        print()
                        last_request_time = None

                # Track completion status responses
                elif msg_type == "completion_status":
                    if last_request_time:
                        latency = (time.time() - last_request_time) * 1000
                        self.latencies.append(latency)

                        status = message.get("data", {})
                        progress = status.get("progress", 0)
                        phase = status.get("phase", 0)

                        print(f"[{timestamp}] ⚡ Completion status in {latency:.0f}ms")
                        print(f"            Progress: {progress}%, Phase: {phase}")
                        print()
                        last_request_time = None

                # Track summary generation
                elif msg_type == "summary":
                    if last_request_time:
                        latency = (time.time() - last_request_time) * 1000
                        print(f"[{timestamp}] 📄 Summary generated in {latency:.0f}ms")
                        print()
                        last_request_time = None

                # Track errors
                elif msg_type == "error":
                    error_msg = message.get("message", "Unknown error")
                    print(f"[{timestamp}] ❌ Error: {error_msg}\n")

        except KeyboardInterrupt:
            print("\n\n⏹️  Monitoring stopped by user")
        except Exception as e:
            print(f"\n\n❌ Error: {e}")

    def print_summary(self) -> None:
        """Print final summary statistics."""
        print("\n" + "=" * 60)
        print("SESSION SUMMARY")
        print("=" * 60)

        duration = time.time() - self.start_time
        minutes = int(duration // 60)
        seconds = int(duration % 60)

        print(f"Duration:         {minutes}m {seconds}s")
        print(f"Questions:        {self.question_count}")

        if self.latencies:
            print(f"\nLatency Stats ({len(self.latencies)} measurements):")
            print(f"  Min:            {min(self.latencies):.0f}ms")
            print(f"  Max:            {max(self.latencies):.0f}ms")
            print(f"  Average:        {sum(self.latencies) / len(self.latencies):.0f}ms")

            # Calculate percentiles
            sorted_latencies = sorted(self.latencies)
            p50 = sorted_latencies[len(sorted_latencies) // 2]
            p95 = sorted_latencies[int(len(sorted_latencies) * 0.95)]

            print(f"  P50 (median):   {p50:.0f}ms")
            print(f"  P95:            {p95:.0f}ms")

            # Performance rating
            avg = sum(self.latencies) / len(self.latencies)
            if avg < 2000:
                rating = "🟢 EXCELLENT"
            elif avg < 3000:
                rating = "🟡 ACCEPTABLE"
            else:
                rating = "🔴 NEEDS OPTIMIZATION"

            print(f"\nPerformance:      {rating}")

        print("=" * 60)

    async def run(self) -> None:
        """Main run loop."""
        try:
            await self.connect()
            await self.monitor()
        finally:
            if self.ws:
                await self.ws.close()
            self.print_summary()


async def main():
    """Main entry point."""
    monitor = PerformanceMonitor()
    await monitor.run()


if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════╗
║         RECRUITER AGENT PERFORMANCE MONITOR              ║
╚══════════════════════════════════════════════════════════╝

This tool monitors live performance metrics while you use
the application. Start the backend and frontend, then run
this script to track latency in real-time.

""")

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped.")
