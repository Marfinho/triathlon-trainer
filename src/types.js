/**
 * @typedef {'swim'|'bike'|'run'|'strength'|'rest'} Sport
 * @typedef {'A'|'B'|'C'} RacePriority
 * @typedef {'sprint'|'volkstriathlon'|'olympic'|'middle'|'running_10k'} RaceDistance
 * @typedef {'finish'|'pb'|'test'} RaceGoal
 *
 * @typedef UserProfile
 * @property {string} id
 * @property {'beginner'|'intermediate'} fitnessLevel
 * @property {number} sessionsPerWeek
 * @property {number} maxSessionMinutes
 * @property {number=} fiveKmTimeSeconds
 * @property {number=} ftpWatts
 *
 * @typedef Race
 * @property {string} id
 * @property {string} date ISO-8601 date string
 * @property {RaceDistance} distance
 * @property {RacePriority} priority
 * @property {RaceGoal} goal
 *
 * @typedef Workout
 * @property {string} id
 * @property {string} date ISO-8601 date string
 * @property {Sport} sport
 * @property {number} durationMinutes
 * @property {1|2|3|4|5} zone
 * @property {string[]} details
 * @property {string} goal
 * @property {string} why
 * @property {'planned'|'done'|'missed'} status
 */

export const ZONE_LABELS = {
  1: 'Erholung',
  2: 'Locker (du kannst sprechen)',
  3: 'Moderat (kontrolliert anstrengend)',
  4: 'Schwelle',
  5: 'VO2max'
};
