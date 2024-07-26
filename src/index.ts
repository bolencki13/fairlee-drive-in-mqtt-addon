import { DriveInMovies } from "./services/devices/DriveInMovies.js";

const driveInMovies = new DriveInMovies();

async function publishDriveInData() {
  await driveInMovies.fetch();

  driveInMovies.publishAvailabililty();
  driveInMovies.publishState();
  driveInMovies.publishAttributes();
}

const ONE_HOUR = 1000 * 60 * 60;

setTimeout(() => {
  publishDriveInData();
}, ONE_HOUR);

publishDriveInData();
