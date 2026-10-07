# Extract SOURCE LOCK + parser

Jangan tambah injector. Pindahkan logic ke modules/source-lock.js dan modules/parts-parser.js, smoke, baru lepas dari build-production.js. PR terpisah — tidak auto-apply ke production UI tanpa smoke.
