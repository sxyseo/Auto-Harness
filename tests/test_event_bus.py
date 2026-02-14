"""Tests for SessionEventBus."""

import asyncio

import pytest

from observer.event_bus import OBSERVER_SOURCE, SessionEventBus
from observer.models import SessionEvent


def _make_event(event_type: str = "test", source: str = "agent", **data) -> SessionEvent:
    return SessionEvent(event_type=event_type, data=data, source=source)


class TestPublish:
    @pytest.mark.asyncio
    async def test_publish_adds_event_to_queue(self):
        bus = SessionEventBus()
        event = _make_event("subtask_completed")
        await bus.publish(event)
        assert bus.qsize() == 1

    @pytest.mark.asyncio
    async def test_publish_dict_converted_to_session_event(self):
        bus = SessionEventBus()
        await bus.publish({"event_type": "phase", "data": {}, "source": "agent"})
        assert bus.qsize() == 1
        events = await bus.drain()
        assert isinstance(events[0], SessionEvent)
        assert events[0].event_type == "phase"

    @pytest.mark.asyncio
    async def test_publish_increments_stats(self):
        bus = SessionEventBus()
        await bus.publish(_make_event())
        await bus.publish(_make_event())
        assert bus.stats.events_published == 2


class TestObserverLoopPrevention:
    @pytest.mark.asyncio
    async def test_observer_source_events_are_ignored(self):
        bus = SessionEventBus()
        await bus.publish(_make_event(source=OBSERVER_SOURCE))
        assert bus.qsize() == 0

    @pytest.mark.asyncio
    async def test_observer_source_not_counted_in_stats(self):
        bus = SessionEventBus()
        await bus.publish(_make_event(source=OBSERVER_SOURCE))
        assert bus.stats.events_published == 0
        assert bus.stats.events_dropped == 0


class TestSubscribe:
    @pytest.mark.asyncio
    async def test_subscribe_yields_published_events(self):
        bus = SessionEventBus()
        await bus.publish(_make_event("a"))
        await bus.publish(_make_event("b"))

        received = []
        async for event in bus.subscribe():
            received.append(event.event_type)
            if len(received) == 2:
                break

        assert received == ["a", "b"]


class TestDrain:
    @pytest.mark.asyncio
    async def test_drain_returns_all_events(self):
        bus = SessionEventBus()
        for i in range(5):
            await bus.publish(_make_event(f"e{i}"))

        events = await bus.drain()
        assert len(events) == 5
        assert [e.event_type for e in events] == [f"e{i}" for i in range(5)]

    @pytest.mark.asyncio
    async def test_drain_empties_queue(self):
        bus = SessionEventBus()
        await bus.publish(_make_event())
        await bus.drain()
        assert bus.qsize() == 0

    @pytest.mark.asyncio
    async def test_drain_empty_queue_returns_empty_list(self):
        bus = SessionEventBus()
        events = await bus.drain()
        assert events == []


class TestQsize:
    @pytest.mark.asyncio
    async def test_qsize_reflects_count(self):
        bus = SessionEventBus()
        assert bus.qsize() == 0
        await bus.publish(_make_event())
        assert bus.qsize() == 1
        await bus.publish(_make_event())
        assert bus.qsize() == 2
        await bus.drain()
        assert bus.qsize() == 0


class TestQueueOverflow:
    @pytest.mark.asyncio
    async def test_overflow_drops_silently(self):
        bus = SessionEventBus(maxsize=10)
        for i in range(15):
            await bus.publish(_make_event(f"e{i}"))

        assert bus.qsize() == 10
        assert bus.stats.events_published == 10
        assert bus.stats.events_dropped == 5

    @pytest.mark.asyncio
    async def test_overflow_at_10001_events(self):
        bus = SessionEventBus()  # default maxsize=10000
        for i in range(10001):
            await bus.publish(_make_event(f"e{i}"))

        assert bus.qsize() == 10000
        assert bus.stats.events_dropped == 1


class TestConcurrentPublish:
    @pytest.mark.asyncio
    async def test_concurrent_publish_from_multiple_coroutines(self):
        bus = SessionEventBus()

        async def publish_batch(prefix: str, count: int):
            for i in range(count):
                await bus.publish(_make_event(f"{prefix}_{i}"))

        await asyncio.gather(
            publish_batch("a", 50),
            publish_batch("b", 50),
            publish_batch("c", 50),
        )

        assert bus.qsize() == 150
        assert bus.stats.events_published == 150


class TestEmptyQueueBehavior:
    @pytest.mark.asyncio
    async def test_get_buffered_events_empty(self):
        bus = SessionEventBus()
        assert bus.get_buffered_events() == []

    @pytest.mark.asyncio
    async def test_qsize_zero_on_new_bus(self):
        bus = SessionEventBus()
        assert bus.qsize() == 0

    @pytest.mark.asyncio
    async def test_stats_zero_on_new_bus(self):
        bus = SessionEventBus()
        assert bus.stats.events_published == 0
        assert bus.stats.events_dropped == 0
