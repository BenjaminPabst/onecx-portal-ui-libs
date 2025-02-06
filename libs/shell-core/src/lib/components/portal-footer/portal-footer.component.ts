import { Component, Inject, OnInit, Optional } from '@angular/core'
import { Router } from '@angular/router'
import { AppStateService, CONFIG_KEY, ConfigurationService, ThemeService } from '@onecx/angular-integration-interface'
import {
  Observable,
  combineLatest,
  concat,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  mergeMap,
  of,
  withLatestFrom,
} from 'rxjs'
import {
  WORKSPACE_CONFIG_BFF_SERVICE_PROVIDER,
  WorkspaceConfigBffService,
} from '../../shell-interface/workspace-config-bff-service-provider'

@Component({
  selector: 'ocx-shell-footer',
  templateUrl: './portal-footer.component.html',
  styleUrls: ['./portal-footer.component.scss'],
})
export class PortalFooterComponent implements OnInit {
  logoUrl$: Observable<string | undefined>
  copyrightMsg$: Observable<string> | undefined
  versionInfo$: Observable<string | undefined>

  constructor(
    private configurationService: ConfigurationService,
    public router: Router,
    private appState: AppStateService,
    private themeService: ThemeService,
    @Optional()
    @Inject(WORKSPACE_CONFIG_BFF_SERVICE_PROVIDER)
    public workspaceConfigBffService: WorkspaceConfigBffService | undefined
  ) {
    this.versionInfo$ = this.appState.currentMfe$.pipe(
      withLatestFrom(this.appState.currentPortal$.asObservable()),
      map(([mfe, portal]) => {
        const mfeInfoVersion = mfe?.version || ''
        const mfeName = mfe?.displayName
        const hostVersion = this.configurationService.getProperty(CONFIG_KEY.APP_VERSION) || 'DEV-LOCAL'
        const mfInfoText = mfeName ? `MF ${mfeName} v${mfeInfoVersion}` : ''
        return `Portal: ${portal.portalName} v${hostVersion} ${mfInfoText}`
      })
    )
    this.logoUrl$ = combineLatest([
      this.themeService.currentTheme$.asObservable(),
      this.appState.currentWorkspace$.asObservable(),
    ]).pipe(
      map(([theme, portal]) => {
        if (!theme.logoUrl && !portal.logoUrl) {
          return { name: theme.name ?? '' }
        }
        return { url: theme.logoUrl || portal.logoUrl }
      }),
      distinctUntilChanged((a, b) => a.url === b.url && a.name === b.name),
      debounceTime(50),
      mergeMap((info) => {
        if (!info.url && info.name) {
          return (this.workspaceConfigBffService?.getThemeLogoByName(info.name) ?? of()).pipe(
            filter((blob) => !!blob),
            map((blob) => URL.createObjectURL(blob))
          )
        }
        return of(info.url)
      })
    )
  }

  ngOnInit(): void {
    this.copyrightMsg$ = concat(
      of('All rights reserved.'),
      this.appState.currentWorkspace$.pipe(
        map((portalData) => {
          if (
            !(
              portalData.footerLabel === '' ||
              portalData.footerLabel === 'string' ||
              portalData.footerLabel === undefined
            )
          ) {
            return portalData.companyName || portalData.footerLabel || 'All rights reserved.'
          }
          return ''
        })
      )
    )
  }

  public onErrorHandleSrc(): void {
    this.logoUrl$ = of(undefined)
  }

  onLoad(logoUrl: string) {
    if (logoUrl.startsWith('blob: ')) {
      URL.revokeObjectURL(logoUrl)
    }
  }
}
