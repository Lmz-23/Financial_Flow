import journal from './meta/_journal.json';
import m0000 from './0000_harsh_excalibur.sql';
import m0001 from './0001_owner_triggers.sql';
import m0002 from './0002_account_transfers.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002
    }
  }
  