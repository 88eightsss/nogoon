-- Makes Happening near you an updating feed. Sources flagged auto_approve publish the events the
-- weekly job finds (an event needs a date or to be recurring); everything else still waits as 'pending'.
-- To remove a wrong listing: update community_events set status = 'hidden' where id = '...';
-- To stop a source: update event_sources set active = false where url = '...';
alter table public.event_sources add column if not exists auto_approve boolean not null default false;

-- Starter sources: local news feeds (the job reads the headlines and descriptions and keeps the ones that
-- announce an upcoming community event) and a few organiser pages. The job reports which ones failed.
insert into public.event_sources (region, kind_hint, url, notes, auto_approve) values
  ('Maui',               'community', 'https://mauinow.com/feed/',                              'Maui Now news feed: upcoming events announced in the news', true),
  ('Oahu',               'community', 'https://www.civilbeat.org/feed/',                        'Honolulu Civil Beat news feed',                             true),
  ('Oahu',               'community', 'https://www.staradvertiser.com/feed/',                   'Honolulu Star-Advertiser news feed',                        true),
  ('Maui',               'community', 'https://www.mauihawaii.org/events-calendar/',            'Maui Visitors Bureau yearly calendar',                      true),
  ('Hawaii (statewide)', 'market',    'https://www.gohawaii.com/node/791',                      'Hawaii Tourism Authority farmers markets',                  true),
  ('Hawaii (statewide)', 'volunteer', 'https://www.wildhawaii.org/get-involved/volunteer/',     'Hawaii Wildlife Fund volunteer page',                       true),
  ('Hawaii (statewide)', 'volunteer', 'https://kahea.org/events',                               'KAHEA events',                                              true)
on conflict (url) do nothing;
