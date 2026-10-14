import { test } from "node:test";
import assert from "node:assert/strict";
import { busyAt, parseIcs } from "./calendar";

const ics = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}END:VCALENDAR\r\n`;
const ev = (lines: string[]) => `BEGIN:VEVENT\r\n${lines.join("\r\n")}\r\nEND:VEVENT\r\n`;
const at = (iso: string) => Date.parse(iso);

test("acara UTC biasa", () => {
  const e = parseIcs(ics(ev(["DTSTART:20261014T020000Z", "DTEND:20261014T030000Z", "SUMMARY:Standup"])));
  assert.equal(busyAt(e, at("2026-10-14T02:30:00Z"))?.title, "Standup");
  assert.equal(busyAt(e, at("2026-10-14T03:00:00Z")), null);
});

test("zona waktu Asia/Jakarta (UTC+7)", () => {
  const e = parseIcs(ics(ev(["DTSTART;TZID=Asia/Jakarta:20261014T090000", "DTEND;TZID=Asia/Jakarta:20261014T100000"])));
  assert.ok(busyAt(e, at("2026-10-14T02:15:00Z"))); // 09:15 WIB
  assert.equal(busyAt(e, at("2026-10-14T03:15:00Z")), null); // 10:15 WIB
});

test("pengulangan mingguan Senin/Rabu + EXDATE", () => {
  const e = parseIcs(
    ics(ev(["DTSTART:20261005T020000Z", "DTEND:20261005T023000Z", "RRULE:FREQ=WEEKLY;BYDAY=MO,WE", "EXDATE:20261012T020000Z"])),
  );
  assert.ok(busyAt(e, at("2026-10-14T02:10:00Z"))); // Rabu
  assert.equal(busyAt(e, at("2026-10-13T02:10:00Z")), null); // Selasa
  assert.equal(busyAt(e, at("2026-10-12T02:10:00Z")), null); // Senin dikecualikan
  assert.ok(busyAt(e, at("2026-10-19T02:10:00Z"))); // Senin berikutnya
});

test("acara seharian, dibatalkan, atau 'free' diabaikan; baris terlipat digabung", () => {
  const e = parseIcs(
    ics(
      ev(["DTSTART;VALUE=DATE:20261014", "DTEND;VALUE=DATE:20261015"]) +
        ev(["DTSTART:20261014T020000Z", "DTEND:20261014T030000Z", "STATUS:CANCELLED"]) +
        ev(["DTSTART:20261014T020000Z", "DTEND:20261014T030000Z", "TRANSP:TRANSPARENT"]) +
        ev(["DTSTART:20261014T040000Z", "DURATION:PT45M", "SUMMARY:Review", " sprint"]),
    ),
  );
  assert.equal(busyAt(e, at("2026-10-14T02:30:00Z")), null);
  assert.equal(busyAt(e, at("2026-10-14T04:30:00Z"))?.title, "Reviewsprint");
});
