-- Optional photo for a Briefing story. image_url is a link to the publisher's own preview image
-- (RSS media thumbnail) or a Wikimedia Commons thumbnail; we never copy or host the file.
-- image_credit is shown under the photo. Both stay null when a story has no picture.
alter table public.feed_items
  add column if not exists image_url text,
  add column if not exists image_credit text;
