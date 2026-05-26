import { MotionProfile } from './motion-profile.types';
import { seedGenericMotionProfiles } from './motion-library.seed';

export class MotionLibraryRepository {
  private readonly profiles = new Map<string, MotionProfile>();

  constructor(initialProfiles: MotionProfile[] = seedGenericMotionProfiles()) {
    for (const profile of initialProfiles) {
      this.profiles.set(profile.id, profile);
    }
  }

  listAll(): MotionProfile[] {
    return Array.from(this.profiles.values());
  }

  listByCategory(category: string): MotionProfile[] {
    return this.listAll().filter((profile) => profile.category === category);
  }

  getById(id: string): MotionProfile | undefined {
    return this.profiles.get(id);
  }

  upsert(profile: MotionProfile): void {
    this.profiles.set(profile.id, profile);
  }

  count(): number {
    return this.profiles.size;
  }
}

export const motionLibraryRepository = new MotionLibraryRepository();
