-- UUID v7 (RFC 9562): 48-bit big-endian millisecond timestamp, then random.
-- PostgreSQL 18 ships uuidv7() natively; this project is on 17.6.
create or replace function public.uuid_generate_v7()
returns uuid
as $$
declare
  unix_ts_ms bytea;
  uuid_bytes bytea;
begin
  unix_ts_ms := substring(int8send((extract(epoch from clock_timestamp()) * 1000)::bigint) from 3);

  -- random bytes for the remaining 10 octets
  uuid_bytes := uuid_send(gen_random_uuid());

  -- overlay the timestamp into octets 1-6
  uuid_bytes := overlay(uuid_bytes placing unix_ts_ms from 1 for 6);

  -- octet 7: set the high nibble to 0111 (version 7), keep the low nibble random
  uuid_bytes := set_byte(uuid_bytes, 6,
    (b'0111' || substring(get_byte(uuid_bytes, 6)::bit(8) from 5 for 4))::bit(8)::int);

  -- octet 9: set the two high bits to 10 (RFC 4122 variant), keep the rest random
  uuid_bytes := set_byte(uuid_bytes, 8,
    (b'10' || substring(get_byte(uuid_bytes, 8)::bit(8) from 3 for 6))::bit(8)::int);

  return encode(uuid_bytes, 'hex')::uuid;
end
$$ language plpgsql volatile;
