type AppIconProps = {
  size: number;
};

export function AppIcon({ size }: AppIconProps) {
  const ringOuter = Math.max(3, Math.round(size * 0.045));
  const ringInner = Math.max(2, Math.round(size * 0.03));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        borderRadius: size * 0.24,
        background: "linear-gradient(160deg, #0f2742 0%, #1274ad 62%, #f08a41 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: size * 0.08,
          borderRadius: size * 0.18,
          background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02))",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: size * 0.68,
          height: size * 0.68,
          borderRadius: "50%",
          border: `${ringOuter}px solid rgba(255,255,255,0.16)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: size * 0.46,
          height: size * 0.46,
          borderRadius: "50%",
          border: `${ringInner}px solid rgba(255,255,255,0.24)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: size * 0.22,
          width: size * 0.56,
          height: size * 0.08,
          borderRadius: size,
          background: "rgba(255,255,255,0.18)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: size * 0.27,
          width: size * 0.18,
          height: size * 0.28,
          borderRadius: size * 0.05,
          background: "#ffffff",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: size * 0.49,
          width: size * 0.36,
          height: size * 0.13,
          borderRadius: size * 0.08,
          background: "#ffffff",
          justifyContent: "space-between",
          alignItems: "center",
          paddingInline: size * 0.05,
          display: "flex",
        }}
      >
        <div
          style={{
            width: size * 0.05,
            height: size * 0.05,
            borderRadius: "50%",
            background: "#1274ad",
          }}
        />
        <div
          style={{
            width: size * 0.05,
            height: size * 0.05,
            borderRadius: "50%",
            background: "#1274ad",
          }}
        />
        <div
          style={{
            width: size * 0.05,
            height: size * 0.05,
            borderRadius: "50%",
            background: "#1274ad",
          }}
        />
      </div>
    </div>
  );
}
