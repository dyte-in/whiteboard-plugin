import "./presence.css";
import Icon from "../icon/Icon";
import { TDUser, TldrawApp } from "@tldraw/tldraw";
import { MainContext } from "../../context";
import { useContext, useEffect, useRef, useState } from "react";

const Presence = () => {
  const {
    app,
    config,
    plugin,
    self,
    users,
    setError,
    followers,
    following,
    setFollowers,
    setFollowing,
  } = useContext(MainContext);
  const hostEl = useRef<HTMLDivElement>(null);
  const [showMore, setShowMore] = useState<boolean>(false);

  useEffect(() => {
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape") handleClick(e);
    });
  }, []);

  const handleClick = (e: any) => {
    if (!e.composedPath().includes(hostEl.current)) {
      setShowMore(false);
    }
  };

  const genName = (name: string) => {
    const n = name.split(" ");
    let initials = "";
    n.map((x, index) => {
      if (index < 2) initials += x[0]?.toUpperCase();
    });
    return initials ?? "P";
  };

  // follow via config
  useEffect(() => {
    if (!config?.follow) return;
    if (!users || !users[config.follow]) return;
    if (following[0] === config.follow) return;
    // emit unfollow
    plugin.emit("unfollow", { id: self.id }, [following[0]]);
    // clear following
    setFollowing([]);
    follow(users[config.follow]);
  }, [config, users]);

  // follow user
  const follow = (user: TDUser) => {
    if (followers.has(user?.metadata?.id)) {
      setError("Can't follow a user who is following you.");
      return;
    }
    // emit req to user
    plugin.emit(
      "followRequest",
      {
        id: self.id,
      },
      [user.metadata.id]
    );
    if (!app.settings.isFocusMode) app.toggleFocusMode();
  };
  useEffect(() => {
    plugin.on("followRequest", ({ id }: { id: string }) => {
      // emit follow response
      plugin.emit("followResponse", { followIds: [self.id, ...following] }, [
        id,
      ]);
      // update followers
      setFollowers((f: Set<string>) => new Set([...f, id]));
      // Allow new followers to pan camera according to me
      const userPayload = {
        user: (app as TldrawApp)?.currentUser,
        camera: app.camera,
        size: { x: window.innerWidth, y: window.innerHeight, zoom: app.zoom },
      };
      const event = new CustomEvent("emit-on-move", { detail: userPayload });
      window.dispatchEvent(event);
    });
    return () => {
      plugin.removeListeners("followRequest");
    };
  }, [following, app]);
  useEffect(() => {
    plugin.on("followResponse", ({ followIds }: { followIds: string[] }) => {
      // update following
      setFollowing((f: string[]) => [...f, ...followIds]);
      // emit follow response to followers
      plugin.emit("followResponse", { followIds }, [...followers]);
    });
    return () => {
      plugin.removeListeners("followResponse");
    };
  }, [followers]);

  /**
   * Do not show presence icons if you are following someone.
   * Do not show presence icons if you are followed by everyone
   */
  if (following[0] || followers?.size === Object.keys(users)?.length)
    return null;

  return (
    <div>
      {(() => {
        const listA = [];
        const listB = [];
        let index = 0;

        for (const userID in users) {
          const user = users[userID];
          if (index > 2) {
            listB.push(
              <div
                key={index}
                className={config.darkMode ? "user-tile-dark" : "user-tile"}
                onClick={() => follow(user)}
              >
                <div
                  key={index}
                  className={config.darkMode ? "user-icon-dark" : "user-icon"}
                  style={{ background: user?.color ?? "blue" }}
                >
                  {genName(user?.metadata?.name ?? "Participant")}
                </div>
                <p>{user.metadata.name}</p>
              </div>
            );
          } else {
            listA.push(
              <div
                key={index}
                className={config.darkMode ? "user-icon-dark" : "user-icon"}
                onClick={() => follow(user)}
                style={{ background: user?.color ?? "blue" }}
              >
                {genName(user?.metadata?.name ?? "Participant")}
                <div className={config.darkMode ? "tooltip-dark" : "tooltip"}>
                  {user?.metadata?.name ?? "Participant"}
                </div>
              </div>
            );
          }
          index += 1;
        }

        if (index > 2) {
          return (
            <div className="user-list">
              {listA}
              <div className="more-users-container" ref={hostEl}>
                {!showMore ? (
                  <Icon
                    onClick={() => setShowMore(true)}
                    className={
                      config.darkMode ? "more-users-dark" : "more-users"
                    }
                    icon="more"
                  />
                ) : (
                  <Icon
                    onClick={() => setShowMore(false)}
                    className={
                      config.darkMode ? "more-users-dark" : "more-users"
                    }
                    icon="less"
                  />
                )}
                {showMore && (
                  <div
                    className={
                      config.darkMode ? "user-dropdown-dark" : "user-dropdown"
                    }
                  >
                    {listB}
                  </div>
                )}
              </div>
            </div>
          );
        }
        return <div className="user-list">{listA}</div>;
      })()}
    </div>
  );
};

export default Presence;
