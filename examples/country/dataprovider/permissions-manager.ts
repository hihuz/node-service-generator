import { ApplicationError } from "../../../src/common/errors/application-error.class";
import { AuthContextMetadata } from "../../../src/common/context/auth-context-metadata.class";
import { ClientError } from "../../../src/common/errors/client-error.config";
import Country from "../../models/country";
import { PermissionsManager } from "../../../src/common/generator/permissions-manager";
import { PermissionDefinition } from "src/common/generator/permissions-manager";
import { Roles } from "examples/constants/permissions";

export class CountryPermissionsManager extends PermissionsManager<Country> {
  protected model = Country;
  protected definitions: PermissionDefinition[] = [];

  /**
   * @inheritDoc
   */
  public async validateReadPermissions(
    state: AuthContextMetadata
  ): Promise<void> {
    const isReader = state.hasValue(Roles.READER);

    if (!isReader) {
      throw new ApplicationError(ClientError.AUTH.FORBIDDEN.NO_PERMISSIONS);
    }
  }
}
